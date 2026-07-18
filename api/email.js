// ════════════════════════════════════════════════════════════════════
// api-email.js — EmailJS + SMTP fallback email sending.
//
// Attaches onto the shared `app` object (same pattern as utils.js,
// allocation.js, api-supabase.js), so it must load AFTER app.js. Every
// existing call site (this.sendEmailWithFallback(), this.setActiveView
// ('emailSettings') -> this.renderEmailSettingsView(), the "Notify
// Staff by Email" button -> this.showEmailNotifyModal(), etc.) keeps
// working unchanged.
//
// Covers:
//   - sendEmailWithFallback()   — the core send: tries EmailJS first,
//     falls back to a configurable HTTP relay (SMTP-sending backend)
//     if EmailJS is unconfigured or fails.
//   - Email Settings admin view — renderEmailSettingsView(),
//     doSaveEmailSettings(), doTestOtpEmail(), doTestSmtpFallback().
//   - Bulk results notification — showEmailNotifyModal(),
//     sendResultsNotification() (loops staff, calls
//     sendEmailWithFallback() per employee).
//
// NOT included here (deliberately, out of scope for this pass):
// the forgot-password/OTP flow that *uses* sendEmailWithFallback (it
// lives with the rest of auth in app.js today, and will move with
// views/auth.js), and writeAuditLog (a separate later pass, per
// api-supabase.js's header note).
// ════════════════════════════════════════════════════════════════════

            // ==================== EMAIL SEND (EmailJS + SMTP fallback) ====================
            // Tries EmailJS first. If it's unconfigured or the send fails (network error,
            // bad keys, EmailJS outage, etc.), falls back to a configurable HTTP relay
            // endpoint that the admin points at their own SMTP-sending backend
            // (e.g. a Supabase Edge Function using nodemailer). Browsers can't speak raw
            // SMTP directly, so the fallback always goes through an HTTP endpoint like this.
            //
            // vars: the EmailJS template variables (to_email, to_name, otp_code, etc.)
            // returns { sent: boolean, method: 'emailjs'|'smtp'|null, error: string }
            app.sendEmailWithFallback = async function(vars) {
                const svcId  = this.state.ejsServiceId  || localStorage.getItem('ejs_service')  || '';
                const tplId  = this.state.ejsTemplateId || localStorage.getItem('ejs_template') || '';
                const pubKey = this.state.ejsPublicKey  || localStorage.getItem('ejs_pubkey')   || '';
                const fbUrl  = this.state.smtpFallbackUrl || localStorage.getItem('smtp_fallback_url') || '';
                const fbKey  = this.state.smtpFallbackKey || localStorage.getItem('smtp_fallback_key') || '';

                let lastError = '';

                // Method 1 — EmailJS
                if (svcId && tplId && pubKey) {
                    try {
                        emailjs.init(pubKey);
                        await emailjs.send(svcId, tplId, vars);
                        return { sent: true, method: 'emailjs', error: '' };
                    } catch (err) {
                        lastError = 'EmailJS: ' + (err?.text || err?.message || JSON.stringify(err));
                        console.warn('EmailJS send failed, trying SMTP fallback:', lastError);
                    }
                } else {
                    lastError = 'EmailJS not configured';
                }

                // Method 2 — SMTP fallback relay
                if (fbUrl) {
                    try {
                        const resp = await fetch(fbUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...(fbKey ? { 'Authorization': 'Bearer ' + fbKey } : {})
                            },
                            body: JSON.stringify({
                                to: vars.to_email || vars.email,
                                to_name: vars.to_name || '',
                                subject: vars.subject || 'Annual Leave System notification',
                                vars
                            })
                        });
                        if (!resp.ok) throw new Error('Relay responded ' + resp.status);
                        return { sent: true, method: 'smtp', error: '' };
                    } catch (err) {
                        lastError += (lastError ? ' | ' : '') + 'SMTP fallback: ' + (err?.message || String(err));
                        console.error('SMTP fallback also failed:', err);
                    }
                }

                return { sent: false, method: null, error: lastError };
            };

            // ==================== EMAIL SETTINGS (Admin Only) ====================

            app.renderEmailSettingsView = function() {
                const content = document.getElementById('contentArea');
                const svc = localStorage.getItem('ejs_service')  || '';
                const tpl = localStorage.getItem('ejs_template') || '';
                const key = localStorage.getItem('ejs_pubkey')   || '';
                const smtpUrl = this.state.smtpFallbackUrl || localStorage.getItem('smtp_fallback_url') || '';
                const smtpKey = this.state.smtpFallbackKey || localStorage.getItem('smtp_fallback_key') || '';
                const savedPlannerEmail = localStorage.getItem('ejs_planner_email') || '';
                if (savedPlannerEmail && !this.state.plannerEmail) this.state.plannerEmail = savedPlannerEmail;
                content.innerHTML = `
                    <div class="max-w-lg mx-auto">
                        <div class="bg-white rounded-xl shadow-xl p-8">
                            <h2 class="text-2xl font-bold mb-1">⚙️ Email Settings</h2>
                            <p class="text-gray-500 text-sm mb-6">Configure EmailJS once here. Users never see this screen — these keys are used silently when sending OTP codes.</p>
                            <div id="esMsg"></div>
                            <div class="space-y-5">
                                <div>
                                    <label class="block font-semibold mb-1 text-sm">Planner Recovery Email</label>
                                    <input type="email" id="esPlannerEmail" value="${this.state.plannerEmail || ''}"
                                        class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none text-sm" />
                                    <p class="text-xs text-gray-400 mt-1">OTPs for Planner password recovery are sent here.</p>
                                </div>
                                <hr class="border-gray-200"/>
                                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">EmailJS Configuration</p>
                                <div>
                                    <label class="block font-semibold mb-1 text-sm">Service ID</label>
                                    <input type="text" id="esServiceId" placeholder="service_xxxxxxx" value="${svc}"
                                        class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none font-mono text-sm" />
                                </div>
                                <div>
                                    <label class="block font-semibold mb-1 text-sm">Template ID</label>
                                    <input type="text" id="esTemplateId" placeholder="template_xxxxxxx" value="${tpl}"
                                        class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none font-mono text-sm" />
                                    <p class="text-xs text-gray-400 mt-1">Template must include: <code>{{to_email}}</code>, <code>{{to_name}}</code>, <code>{{otp_code}}</code></p>
                                </div>
                                <div>
                                    <label class="block font-semibold mb-1 text-sm">Public Key</label>
                                    <input type="text" id="esPublicKey" placeholder="xxxxxxxxxxxxxxxxxxxx" value="${key}"
                                        class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none font-mono text-sm" />
                                </div>
                                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                                    <strong>How to set up EmailJS (free):</strong><br/>
                                    1. Go to <a href="https://www.emailjs.com" target="_blank" class="underline">emailjs.com</a> and create an account.<br/>
                                    2. Add your email service (Gmail, Outlook…).<br/>
                                    3. Create a template with the variables above.<br/>
                                    4. Copy your Service ID, Template ID, and Public Key here.
                                </div>
                                <hr class="border-gray-200"/>
                                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">SMTP Fallback (optional)</p>
                                <div>
                                    <label class="block font-semibold mb-1 text-sm">Relay Endpoint URL</label>
                                    <input type="text" id="esSmtpUrl" placeholder="https://your-project.functions.supabase.co/send-email" value="${smtpUrl}"
                                        class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none font-mono text-sm" />
                                    <p class="text-xs text-gray-400 mt-1">If EmailJS fails or is unreachable, the app POSTs the email here instead.</p>
                                </div>
                                <div>
                                    <label class="block font-semibold mb-1 text-sm">Relay Auth Token (optional)</label>
                                    <input type="text" id="esSmtpKey" placeholder="shared secret / bearer token" value="${smtpKey}"
                                        class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none font-mono text-sm" />
                                </div>
                                <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                                    <strong>Why a URL, not SMTP host/port?</strong> Browsers can't open raw SMTP connections — only a server can. Point this at a small server-side endpoint (e.g. a Supabase Edge Function) that receives <code>{to, subject, vars}</code> as JSON and sends the email via your SMTP account (Gmail, Outlook, your company mail server, etc.). Ask your developer to deploy one if you don't have it yet.
                                </div>
                            </div>
                            <div class="flex gap-3 mt-7">
                                <button onclick="app.doSaveEmailSettings()" class="flex-1 px-5 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-semibold">💾 Save</button>
                                <button onclick="app.doTestOtpEmail()" class="flex-1 px-5 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 font-semibold">🧪 Test EmailJS</button>
                                <button onclick="app.doTestSmtpFallback()" class="flex-1 px-5 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-semibold">🧪 Test SMTP Fallback</button>
                                <button onclick="app.setActiveView('admin')" class="px-5 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold">← Back</button>
                            </div>
                        </div>
                    </div>`;
            };

            app.doSaveEmailSettings = function() {
                const email = document.getElementById('esPlannerEmail')?.value?.trim();
                const svc   = document.getElementById('esServiceId')?.value?.trim();
                const tpl   = document.getElementById('esTemplateId')?.value?.trim();
                const key   = document.getElementById('esPublicKey')?.value?.trim();
                const smtpUrl = document.getElementById('esSmtpUrl')?.value?.trim();
                const smtpKey = document.getElementById('esSmtpKey')?.value?.trim();
                const msg   = document.getElementById('esMsg');
                if (email) this.state.plannerEmail   = email;
                if (svc)   this.state.ejsServiceId   = svc;
                if (tpl)   this.state.ejsTemplateId  = tpl;
                if (key)   this.state.ejsPublicKey   = key;
                this.state.smtpFallbackUrl = smtpUrl || '';
                this.state.smtpFallbackKey = smtpKey || '';
                localStorage.setItem('ejs_planner_email', email || '');
                localStorage.setItem('ejs_service',  svc  || '');
                localStorage.setItem('ejs_template', tpl  || '');
                localStorage.setItem('ejs_pubkey',   key  || '');
                localStorage.setItem('smtp_fallback_url', smtpUrl || '');
                localStorage.setItem('smtp_fallback_key', smtpKey || '');
                this.saveState();
                try { this.saveConfigToSupabase(); } catch (e) {}
                msg.innerHTML = '<div class="mb-4 p-3 rounded-lg border bg-green-50 border-green-300 text-green-700 text-sm">✅ Settings saved! OTP recovery is now active for all roles.</div>';
            };

            app.doTestSmtpFallback = async function() {
                const smtpUrl = (document.getElementById('esSmtpUrl')?.value || '').trim();
                const smtpKey = (document.getElementById('esSmtpKey')?.value || '').trim();
                const email   = (document.getElementById('esPlannerEmail')?.value || '').trim();
                const msg     = document.getElementById('esMsg');
                if (!smtpUrl || !email) {
                    msg.innerHTML = '<div class="mb-4 p-3 rounded-lg border bg-yellow-50 border-yellow-300 text-yellow-700 text-sm">⚠️ Enter a Relay Endpoint URL and a Planner Recovery Email first.</div>';
                    return;
                }
                msg.innerHTML = '<div class="mb-4 p-3 rounded-lg border bg-blue-50 border-blue-200 text-blue-700 text-sm">⏳ Sending test email via SMTP fallback…</div>';
                try {
                    const resp = await fetch(smtpUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(smtpKey ? { 'Authorization': 'Bearer ' + smtpKey } : {})
                        },
                        body: JSON.stringify({
                            to: email,
                            to_name: 'Planner',
                            subject: 'Annual Leave System — SMTP fallback test',
                            vars: { otp_code: '123456', passcode: '123456', employee_id: 'TEST', year: this.state.biddingYear }
                        })
                    });
                    if (!resp.ok) throw new Error('Relay responded ' + resp.status);
                    msg.innerHTML = '<div class="mb-4 p-3 rounded-lg border bg-green-50 border-green-300 text-green-700 text-sm">✅ SMTP fallback relay accepted the test email — check the inbox.</div>';
                } catch (err) {
                    msg.innerHTML = '<div class="mb-4 p-3 rounded-lg border bg-red-50 border-red-300 text-red-700 text-sm">❌ SMTP fallback test failed: ' + (err?.message || err) + '</div>';
                }
            };

            app.doTestOtpEmail = async function() {
                const svc   = (document.getElementById('esServiceId')?.value    || '').trim();
                const tpl   = (document.getElementById('esTemplateId')?.value   || '').trim();
                const key   = (document.getElementById('esPublicKey')?.value    || '').trim();
                const email = (document.getElementById('esPlannerEmail')?.value || '').trim();
                const msg   = document.getElementById('esMsg');
                if (!svc || !tpl || !key || !email) {
                    msg.innerHTML = '<div class="mb-4 p-3 rounded-lg border bg-yellow-50 border-yellow-300 text-yellow-700 text-sm">⚠️ Please fill in all fields before sending a test.</div>';
                    return;
                }
                msg.innerHTML = '<div class="mb-4 p-3 rounded-lg border bg-blue-50 border-blue-200 text-blue-700 text-sm">⏳ Sending test OTP…</div>';
                try {
                    emailjs.init(key);
                    const testExpiry = new Date(Date.now() + 10 * 60 * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    await emailjs.send(svc, tpl, {
                        email: email, to_email: email, to_name: 'Planner',
                        otp_code: '123456', passcode: '123456',
                        time: testExpiry,
                        company_name: 'Resource Planning Team at Flow',
                        Annual_Leave_System_RP: 'Resource Planning Team at Flow',
                        website_link: window.location.href,
                        employee_id: 'TEST', year: this.state.biddingYear
                    });
                    msg.innerHTML = `<div class="mb-4 p-3 rounded-lg border bg-green-50 border-green-300 text-green-700 text-sm">✅ Test OTP (123456) sent to <strong>${email}</strong>. Check your inbox!</div>`;
                } catch (err) {
                    msg.innerHTML = `<div class="mb-4 p-3 rounded-lg border bg-red-50 border-red-300 text-red-700 text-sm">❌ Failed: ${err?.text || err?.message || JSON.stringify(err)}</div>`;
                }
            };

            // ==================== EMAIL NOTIFICATION ====================
            app.showEmailNotifyModal = function() {
                document.getElementById('emailModal').style.display = 'flex';
                document.getElementById('emailModalMsg').innerHTML = '';
                document.getElementById('emailProgress').style.display = 'none';
            };

            app.sendResultsNotification = async function() {
                const serviceId  = document.getElementById('ejsServiceId').value.trim();
                const templateId = document.getElementById('ejsTemplateId').value.trim();
                const publicKey  = document.getElementById('ejsPublicKey').value.trim();
                const msgEl = document.getElementById('emailModalMsg');

                if (!serviceId || !templateId || !publicKey) {
                    msgEl.innerHTML = '<div style="padding:10px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;font-size:0.8rem;margin-bottom:12px;">⚠️ Please fill in all three EmailJS fields.</div>';
                    return;
                }

                // Save keys for next time
                localStorage.setItem('ejs_service', serviceId);
                localStorage.setItem('ejs_template', templateId);
                localStorage.setItem('ejs_pubkey', publicKey);

                // Get unique employees with emails
                const staffToNotify = this.state.employees.filter(e => e.email);
                if (staffToNotify.length === 0) {
                    msgEl.innerHTML = '<div style="padding:10px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;font-size:0.8rem;margin-bottom:12px;">❌ No employee emails found. Make sure emails are loaded from the database.</div>';
                    return;
                }

                // Init EmailJS
                try { emailjs.init(publicKey); } catch(e) { console.warn('EmailJS init:', e); }

                // Show progress
                const prog = document.getElementById('emailProgress');
                const bar  = document.getElementById('emailProgressBar');
                const txt  = document.getElementById('emailProgressText');
                prog.style.display = 'block';
                msgEl.innerHTML = '';

                let sent = 0, failed = 0, viaFallback = 0;
                for (let i = 0; i < staffToNotify.length; i++) {
                    const emp = staffToNotify[i];
                    const result = await this.sendEmailWithFallback({
                        to_email: emp.email,
                        to_name: emp.name,
                        employee_id: emp.id,
                        year: this.state.biddingYear,
                        subject: 'Your Annual Leave results are ready'
                    });
                    if (result.sent) {
                        sent++;
                        if (result.method === 'smtp') viaFallback++;
                    } else {
                        console.warn(`Failed to send to ${emp.email}:`, result.error);
                        failed++;
                    }
                    const pct = Math.round(((i+1)/staffToNotify.length)*100);
                    bar.style.width = pct + '%';
                    txt.textContent = `Sending... ${i+1}/${staffToNotify.length} (${sent} sent, ${failed} failed)`;
                    // Small delay to avoid rate limiting
                    await new Promise(r => setTimeout(r, 300));
                }

                prog.style.display = 'none';
                const color = failed === 0 ? '#f0fdf4;border-color:#bbf7d0;color:#166534' : '#fef2f2;border-color:#fecaca;color:#991b1b';
                msgEl.innerHTML = `<div style="padding:10px;background:${color};border:1px solid;border-radius:8px;font-size:0.8rem;margin-bottom:12px;">
                    ${failed===0?'✅':'⚠️'} Done! ${sent} emails sent${viaFallback>0?` (${viaFallback} via SMTP fallback)`:''}${failed>0?`, ${failed} failed`:''}.</div>`;
            };
