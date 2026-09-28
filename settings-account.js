/* Settings sheet and the account dialog: sign-in, sign-up, password, access code, device accounts, account deletion, the build/version sheet and the models sheet.
   Moved out of index.html unchanged on 2026-09-28 (v3.1.16). It is loaded in
   index.html at the same point it used to sit, so it runs in the same order.
   See architecture/CODE_MAP.md. */
"use strict";

/* ================= Settings ================= */
function organizeSettingsPanel() {
  const panel = $("settings-panel");
  if (panel.dataset.organized) return;
  panel.dataset.organized = "true";
  const heading = panel.querySelector("h3");
  const dismiss = document.createElement("button"); dismiss.id = "settings-dismiss";dismiss.type = "button";dismiss.textContent = "×";dismiss.setAttribute("aria-label","Close Settings");dismiss.onclick = () => closeSettings(true,true);panel.prepend(dismiss);
  const intro = document.createElement("p"); intro.className = "settings-intro"; intro.textContent = "Your learning, your space.";
  heading.after(intro);
  function group(title, nodes, open = false, flat = false) {
    const details = document.createElement(flat ? "section" : "details"); details.className = "settings-group"; details.open = open;
    if (flat) details.classList.add("settings-group-flat");
    const summary = document.createElement("summary"); summary.textContent = title;
    const body = document.createElement("div"); body.className = "settings-group-body";
    nodes.filter(Boolean).forEach(node => body.appendChild(node));
    if (flat) details.append(body); else details.append(summary, body);
    intro.after(details); return details;
  }
  const fieldNodes = id => { const field=$(id), label=field && field.previousElementSibling; return [label,field]; };
  const model = fieldNodes("set-model"), thinking = fieldNodes("set-thinking"), speechLanguage = fieldNodes("set-speechlanguage"), theme = fieldNodes("set-theme"), microphoneLauncher = $("settings-microphone-launcher");
  const voiceDefault = $("set-voicedefault") && $("set-voicedefault").closest("label");
  if (voiceDefault) { voiceDefault.className = "settings-check";voiceDefault.hidden = true; }
  const developerToggle = $("set-developer") && $("set-developer").closest("label");
  if (developerToggle) { developerToggle.className = "settings-check"; developerToggle.hidden = !(state.developerUnlocked && state.developerMode); }
  const speechLanguageHint = $("set-speechlanguage") && $("set-speechlanguage").nextElementSibling;
  if (speechLanguageHint) speechLanguageHint.remove();
  speechLanguage.forEach(node => {if(node) node.hidden=true;});
  theme.forEach(node => {if(node) node.hidden=true;});
  const appearance=document.createElement("section");appearance.id="settings-appearance";
  appearance.innerHTML='<h4>Appearance</h4><div class="theme-choices" role="group" aria-label="Appearance"><button type="button" data-theme-choice="light">☀ Light</button><button type="button" data-theme-choice="dark">☾ Dark</button></div>';
  const learning = group("Learning & conversation", [microphoneLauncher, ...theme, ...speechLanguage, developerToggle], true, true);
  const thinkingHint = $("set-thinking") && $("set-thinking").nextElementSibling;
  const ttsProvider = fieldNodes("set-ttsprovider"), deepgramKey = fieldNodes("set-deepgramkey"), deepgramModel = fieldNodes("set-deepgrammodel");
  const developerStatus = panel.querySelector(".developer-status");
  const voiceTiming = $("voice-timing-panel"), orchestrationLauncher = $("orchestration-launcher");
  const developer = group("Developer model lab", [orchestrationLauncher, ...model, ...thinking, thinkingHint, ...ttsProvider, ...deepgramKey, ...deepgramModel, developerStatus, voiceTiming]);
  developer.id = "settings-developer-group";
  const tester = fieldNodes("set-testercode");
  const connection = group("Tester access", [...tester], true, true);
  connection.id = "settings-tester-group";
  const accountCard = document.createElement("div");
  accountCard.className = "settings-account-card";
  accountCard.innerHTML = `<p id="account-status" class="settings-account-status">Checking account…</p><p id="account-access-status" class="settings-access-status" hidden></p><button id="account-link" type="button">Sign in / create account</button><button id="account-signout" type="button" hidden>Sign out</button>`;
  const account = group("Account",[accountCard],true,true);
  account.id = "settings-account-group";
  const voiceNodes = [];
  ["set-cartkey","set-cartvoice","set-elkey"].forEach(id => { const field=$(id); if(!field)return; const label=field.previousElementSibling, hint=field.nextElementSibling && field.nextElementSibling.classList.contains("hint") ? field.nextElementSibling : null; voiceNodes.push(label,field,hint); });
  const premium = group("Premium voice services", voiceNodes);
  premium.id = "settings-premium-group";
  const row = $("export-btn") && $("export-btn").closest(".row2"), dataLabel = row && row.previousElementSibling, file=$("import-file"), dataHint=file && file.nextElementSibling;
  const data = group("Your data", [dataLabel,row,file,dataHint]);
  data.id = "settings-data-group";
  [account,learning,connection,developer,premium,data].reverse().forEach(section => intro.after(section));
  const workspace = document.createElement("section");
  workspace.id = "settings-workspace";
  workspace.innerHTML = `<div class="workspace-heading"><span class="workspace-kicker">YOUR WORKSPACE</span><span id="workspace-role" class="workspace-badge"></span></div>
    <div class="workspace-stats"><div><strong id="workspace-lessons">0</strong><span>Lessons</span></div><div><strong id="workspace-notes">0</strong><span>Notes</span></div><div><strong id="workspace-save">Connecting</strong><span>Account saving</span></div></div>
    <button id="workspace-sync" class="workspace-action" type="button">Check for updates</button>
    <p id="workspace-sync-result" class="hint" role="status"></p>
    <div id="workspace-owner" hidden><div class="workspace-divider"></div><span class="workspace-kicker">OWNER STUDIO</span><h4>A space to shape Worldview.</h4><p>Explore the model lab, compare your experiments, and return to the learner experience with the same account.</p>
      <button id="workspace-lab" class="workspace-action workspace-primary" type="button">Open Lab <span aria-hidden="true">↗</span></button>
      <button id="workspace-view" class="workspace-action" type="button"></button>
      <details class="workspace-roadmap"><summary>On the horizon</summary><p>Developer invitations, scoped test workspaces and release controls. These will be added here as the project grows.</p></details>
    </div>
    <details id="workspace-recovery" class="workspace-roadmap" hidden><summary>Earlier device library</summary><p>Your account library is ready to use. Older device content remains separate until you choose to add it.</p><button id="workspace-recover" class="workspace-action" type="button">Add earlier lessons to this account</button></details>
    <p class="workspace-version"></p>`;
  account.after(workspace);
  intro.after(appearance);
  appearance.querySelectorAll("[data-theme-choice]").forEach(button => {button.onclick=()=>setAppearance(button.dataset.themeChoice);});
  applyTheme();
  $("workspace-lab").onclick = () => { if (ownerToolsAvailable()) location.assign(new URL("lab/",location.href).href); };
  $("workspace-view").onclick = () => {
    if (!ownerToolsAvailable()) return;
    state.developerMode = !state.developerMode; $("set-developer").checked = state.developerMode;
    save(); syncDeveloperLauncherVisibility(); syncDeveloperSettingsVisibility(); renderAccountWorkspace();
  };
  $("workspace-sync").onclick = async () => {
    if (!permanentAccountVerified() || accountTransitionInProgress) return;
    const button = $("workspace-sync"), result = $("workspace-sync-result"), id = cloudAccount.id;
    button.disabled = true; result.textContent = "Checking your saved library…";
    try {
      if (cloudSyncReady && !accountCacheReadOnly) await cloudSyncNow();
      if (cloudAccount?.id !== id) return;
      if (accountSaveStatus === "error" && !accountCacheReadOnly) throw new Error("save_pending");
      await initCloudPersistence();
      if (cloudAccount?.id !== id) return;
      result.textContent = accountCacheReadOnly ? "Your device copy is safe. Reconnect to finish syncing." : "Your account library is up to date.";
    } catch (_) { if (cloudAccount?.id === id) result.textContent = "Changes are still saved on this device. We will retry when connected."; }
    finally { button.disabled = false; }
  };
  $("workspace-recover").onclick = async () => {
    if (!permanentAccountVerified() || !pendingLegacyRecovery || accountCacheReadOnly) return;
    $("workspace-recover").disabled = true;
    try { await completeLegacyRecovery("import"); } finally { $("workspace-recover").disabled = false;renderAccountWorkspace(); }
  };
  panel.querySelectorAll(".legacy-voice-settings").forEach(wrapper => { if (!wrapper.children.length) wrapper.remove(); });
}
organizeSettingsPanel();
function renderAccountWorkspace() {
  if (!$("settings-workspace")) return;
  const signedIn = permanentAccountVerified(), owner = ownerToolsAvailable();
  $("settings-workspace").hidden = !signedIn;
  $("workspace-role").textContent = owner ? "Owner" : "Learner";
  $("workspace-lessons").textContent = String(state.lessons.length);
  $("workspace-notes").textContent = String(state.notes.length);
  $("workspace-save").textContent = accountCacheReadOnly ? "Offline" : accountSaveStatus === "error" ? "Retrying" : accountSaveStatus === "syncing" ? "Saving" : accountSaveStatus === "synced" ? "Saved" : "Connected";
  $("workspace-owner").hidden = !owner;
  $("workspace-view").textContent = state.developerMode ? "Use learner settings" : "Show developer settings";
  $("workspace-recovery").hidden = !pendingLegacyRecovery;
  $("settings-workspace").querySelector(".workspace-version").textContent = BUILD;
}
const SECRET_SETTING_IDS = ["set-testercode","set-cartkey","set-elkey","set-deepgramkey"];
function credentialFieldIsVisibleWithin(field, root) {
  if (!field || !root || !root.contains(field)) return false;
  for (let node = field; node && node !== root; node = node.parentElement) {
    if (node.hidden || node.inert || (node.tagName === "DETAILS" && !node.open)) return false;
  }
  return true;
}
function syncCredentialFieldInteractivity() {
  const settings = $("settings");
  const settingsOpen = !!(settings && settings.classList.contains("open") && !settings.inert);
  SECRET_SETTING_IDS.forEach(id => {
    const field = $(id);
    if (field) field.disabled = !(settingsOpen && credentialFieldIsVisibleWithin(field,settings));
  });
  const dialog = $("account-dialog");
  if (dialog) dialog.querySelectorAll("input").forEach(field => {
    field.disabled = !(dialog.open && !passwordAccountBusy && credentialFieldIsVisibleWithin(field,dialog));
  });
}
function syncDeveloperSettingsVisibility() {
  const admin = ownerToolsAvailable();
  const developer = !!(admin && state.developerMode);
  const developerToggle = $("set-developer") && $("set-developer").closest("label");
  if (developerToggle) developerToggle.hidden = true; // Workspace view switch is the single control.
  const group = $("settings-developer-group");
  if (group) group.hidden = !developer;
  if (developer) renderVoiceTimingReadout();
  const premium = $("settings-premium-group");
  if (premium) premium.hidden = true;
  const data = $("settings-data-group");
  if (data) data.hidden = true;
  const tester = $("settings-tester-group");
  if (tester) tester.hidden = true;
  $("settings-microphone-launcher").hidden = true;
  $("intro-replay").hidden = !developer;
  document.querySelectorAll(".owner-provider-field").forEach(node => { node.hidden = !developer; });
  renderAccountWorkspace();
  syncCredentialFieldInteractivity();
}
const ACCOUNT_PENDING_KEY = "worldview-account-pending-v1";
// A pending confirmation contains only local routing hints, never a password.
const EMAIL_OTP_ENABLED = false; // Retired: ordinary sign-in now uses a password.
let accountPending = (() => {
  try {
    const value = JSON.parse(localStorage.getItem(ACCOUNT_PENDING_KEY) || "null");
    return value?.email && Date.now() - Number(value.sentAt || 0) < 24 * 60 * 60 * 1000 ? value : null;
  } catch (error) { return null; }
})();
let passwordAccountMode = "signin", passwordAccountBusy = false;
let passwordCommandPending = null;
let passwordAccountMessage = "", passwordAccountError = false;
let accountReturnToLab = new URLSearchParams(location.search).get("returnTo") === "lab";
function setAccountPending(value) {
  accountPending = value;
  try {
    if (value) localStorage.setItem(ACCOUNT_PENDING_KEY,JSON.stringify(value));
    else localStorage.removeItem(ACCOUNT_PENDING_KEY);
  } catch (error) {}
}
function markPasswordRecovery(userId) {
  passwordRecoveryUserId = String(userId || "");
  try {
    if (userId) localStorage.setItem(PASSWORD_RECOVERY_KEY,JSON.stringify({userId,startedAt:Date.now()}));
    else localStorage.removeItem(PASSWORD_RECOVERY_KEY);
  } catch (error) {}
}
function clearPasswordFields() {
  ["password-account-secret","password-account-confirm"].forEach(id => { if ($(id)) $(id).value = ""; });
}
function passwordAccountNotice(message = "", isError = false) {
  passwordAccountMessage = message;
  passwordAccountError = isError;
  const status = $("password-account-status");
  if (status) { status.textContent = message;status.dataset.error = String(isError); }
}
function accountEmailRedirect() {
  // Only the exact current app origin/path; no caller-controlled return URL.
  return location.origin + location.pathname;
}
function accountOperationDeadline(promise, message = "The account service took too long. Please try again.") {
  let timer;
  return Promise.race([promise,new Promise((_,reject) => {
    timer = setTimeout(() => reject(new Error(message)),15000);
  })]).finally(() => clearTimeout(timer));
}
async function accountAuthCommand(operation) {
  if (passwordCommandPending) throw new Error("An account request is still finishing.");
  const task = Promise.resolve().then(operation);
  passwordCommandPending = task;
  // boundedAuthFetch aborts the underlying Auth HTTP request/body. Do not
  // Promise.race a write: a timed-out SDK command must not outlive its owner.
  try { return await task; }
  finally { if (passwordCommandPending === task) passwordCommandPending = null; }
}
async function refreshPasswordAccountIdentity() {
  const epoch = accountAuthEpoch;
  try { await accountOperationDeadline(initCloudPersistence()); }
  catch (error) {
    if (epoch !== accountAuthEpoch) return;
    cloudInitGeneration += 1; // invalidate any late read from this refresh
    identityMutationReady = false;cloudSyncReady = false;entitlementAccountId = "";
    identityRestoreStatus = "offline";accountCacheReadOnly = true;
    passwordAccountNotice("Your account request finished, but the library could not reconnect yet. Retry when the connection is ready.",true);
  }
}
function accountEntryNeeded() {
  return !!(backendClient && (!permanentAccountVerified() || accountRecoveryRequired()));
}
function renderPasswordAccount() {
  const dialog = $("account-dialog");
  if (!dialog) return;
  const mode = passwordAccountMode;
  const upgrade = mode === "upgrade";
  const update = mode === "update";
  const verify = mode === "verify";
  const signup = mode === "signup";
  const reset = mode === "reset";
  const manage = mode === "manage";
  const checking = mode === "checking";
  const welcome = mode === "welcome";
  const verifyPassword = verify && accountPending?.mode !== "email_change";
  const needsPassword = ["signin","signup","update"].includes(mode) || verifyPassword;
  dialog.dataset.mode = mode;
  $("account-summary").hidden = !manage;
  $("account-welcome").hidden = !welcome;
  $("account-email").textContent = cloudAccount?.email || "";
  $("account-avatar").textContent = (cloudAccount?.email || "")[0] || "";
  $("password-account-back").hidden = checking || accountRecoveryRequired() || (["welcome","signin","verify"].includes(mode) && accountEntryNeeded());
  $("password-account-back").disabled = passwordAccountBusy;
  $("password-account-back").setAttribute("aria-label",manage ? "Close account" : "Back");
  $("password-account-back").querySelector("path").setAttribute("d",manage ? "M6 6l12 12M18 6 6 18" : "m14 6-6 6 6 6M8 12h12");
  $("password-account-form").hidden = manage || checking || welcome;
  $("account-dialog-title").textContent = welcome ? "Learn anything by talking it through" : checking ? "Checking your account…" : update ? (accountRecoveryRequired() ? "Set your password" : "Change password") : upgrade ? "Keep your existing library" : verify ? "Check your email" : reset ? "Reset your password" : signup ? "Create account" : manage ? "Your account" : "Sign in";
  $("account-dialog-copy").textContent = welcome ? "Worldview is a tutor you talk with. Bring a question and it builds a researched lesson around it, then works through it with you."
    : checking ? "Restoring your secure session."
    : upgrade ? "Connect an email to this device's existing account. Verify it first, then choose a password. Your lessons stay with the same account."
    : update ? "Choose a password of at least 12 characters. A memorable phrase works well."
    : verify ? (verifyPassword ? "Confirm your email, then enter your password here to open your library on this device." : "Open the confirmation email, then return here to continue.")
    : reset ? "If an account uses this email, we'll send a password-reset link."
    : signup ? "Email and password only. Confirm your email before starting."
    : manage ? "Your space in Worldview."
    : cloudAccount?.is_anonymous
      ? "Your lessons, wherever you return. Earlier device work stays safely separate."
      : "Your lessons, wherever you return.";
  $("password-account-email-label").hidden = update || verify || manage || checking;
  $("password-account-email").hidden = update || verify || manage || checking;
  $("password-account-secret-group").hidden = !needsPassword;
  $("password-account-confirm-group").hidden = !(signup || update);
  $("password-account-secret").autocomplete = (mode === "signin" || verifyPassword) ? "current-password" : "new-password";
  $("password-account-secret").minLength = (mode === "signin" || verifyPassword) ? 1 : 12;
  $("account-switch-confirm-label").hidden = true;
  $("password-account-submit").hidden = manage || checking;
  $("password-account-submit").textContent = update ? "Save password" : upgrade ? "Send confirmation" : verify ? "Continue" : reset ? "Send reset link" : signup ? "Create account" : "Sign in";
  $("password-account-signup").hidden = !["signin","upgrade"].includes(mode);
  if (welcome) $("password-account-forgot").hidden = true;
  $("password-account-signup").textContent = "Create account";
  $("password-account-forgot").hidden = !["signin","verify"].includes(mode);
  $("password-account-signin").hidden = !["signup","reset","verify","upgrade"].includes(mode);
  $("password-account-resend").hidden = !verify || !accountPending;
  $("password-account-close").hidden = true; // The header arrow is the single return control.
  $("password-account-signout").hidden = (!cloudAccount && !accountSignoutPending()) || checking || cloudAccount?.is_anonymous === true;
  $("password-account-signout").textContent = accountSignoutPending() ? "Retry sign out" : "Sign out";
  $("password-account-remember").hidden = checking || manage || welcome;
  $("password-account-fields").disabled = passwordAccountBusy || checking;
  dialog.querySelectorAll(".account-dialog-actions button").forEach(button => { button.disabled = passwordAccountBusy; });
  $("password-account-form").setAttribute("aria-busy",String(passwordAccountBusy));
  passwordAccountNotice(passwordAccountMessage,passwordAccountError);
  renderDeviceAccounts();
  syncCredentialFieldInteractivity();
}
/* The welcome is shown to a visitor until they choose to create an account or
   sign in; after that this device goes straight to the form. */
const WELCOME_DISMISSED_KEY = "worldview-welcome-dismissed-v1";
function welcomeDismissed() { try { return localStorage.getItem(WELCOME_DISMISSED_KEY) === "1"; } catch (_) { return false; } }
function dismissWelcome() { try { localStorage.setItem(WELCOME_DISMISSED_KEY,"1"); } catch (_) { /* The welcome may simply show again. */ } }
function openPasswordAccount(mode = "", message = "", isError = false) {
  // A device holding an anonymous library still opens on ordinary sign-in.
  // Connecting that library to an email is reached through Create account,
  // which keeps the common path to one screen and one decision.
  if (mode === "upgrade") mode = "signin";
  if (!mode) mode = accountRecoveryRequired() ? "update" : permanentAccountVerified() ? "manage"
    : accountPending ? "verify" : !cloudAccount && !welcomeDismissed() ? "welcome" : "signin";
  if (passwordAccountBusy) { renderPasswordAccount();return; }
  if (passwordAccountMode !== mode) clearPasswordFields();
  passwordAccountMode = mode;
  if ($("intro-demo").classList.contains("open")) setIntroOpen(false,false);
  if ($("settings").classList.contains("open")) closeSettings(false);
  const dialog = $("account-dialog");
  if (!dialog.open) dialog.showModal();
  if (!$("password-account-email").value) $("password-account-email").value = accountPending?.email || cloudAccount?.email || "";
  passwordAccountNotice(message,isError);
  renderPasswordAccount();
  // No automatic input focus/keyboard on phones.
  if (innerWidth <= 700) { $("account-dialog-title").tabIndex = -1;$("account-dialog-title").focus({preventScroll:true}); }
}
function closePasswordAccount() {
  if (accountEntryNeeded() || passwordAccountBusy) return false;
  deviceAccountAddingFrom = "";
  clearPasswordFields();
  $("account-dialog").close();
  syncCredentialFieldInteractivity();
  return true;
}
function reconcileAccountEntry() {
  if (passwordAccountBusy || accountTransitionInProgress) return;
  if (accountRecoveryRequired()) { openPasswordAccount("update");return; }
  if (permanentAccountVerified()) {
    if (deviceAccountAddingFrom === cloudAccount.id && ["signin","signup","verify","reset"].includes(passwordAccountMode)) return;
    deviceAccountAddingFrom = "";
    if (accountPending?.mode !== "email_change" || accountPending?.originalUserId === cloudAccount.id) setAccountPending(null);
    if (["welcome","signin","signup","verify","upgrade","checking"].includes(passwordAccountMode)) closePasswordAccount();
    if (accountReturnToLab) {
      if (ownerToolsAvailable()) { accountReturnToLab = false;location.assign(new URL("lab/",location.href).href);return; }
      openPasswordAccount("manage","Signed in. This account does not have developer access.",true);
      accountReturnToLab = false;
    }
    return;
  }
  if (accountIdentityHeldForRetry() || accountCacheReadOnly) {
    if ($("account-dialog").open && passwordAccountMode === "checking") { $("account-dialog").close();syncCredentialFieldInteractivity(); }
    return;
  }
  openPasswordAccount(accountPending ? "verify" : "");
}
function renderAccountSetupUI() {
  const connected = $("intro-account-connected");
  if (connected) { connected.hidden = !permanentAccountVerified();connected.textContent = permanentAccountVerified() ? "Your library saves to your account." : ""; }
  if ($("account-link")) $("account-link").textContent = permanentAccountVerified() ? "Manage account" : "Sign in / create account";
  renderPasswordAccount();
}
function suspendAccountIdentity() {
  accountAuthEpoch += 1;
  cloudInitGeneration += 1;
  entitlementAccountId = "";
  backendSessionPromise = null;
  clearTimeout(cloudSyncTimer);cloudSyncTimer = 0;
  clearTimeout(identityRetryTimer);identityRetryTimer = 0;identityRetryDelay = 0;
  accountRequestControllers.forEach(controller => { try { controller.abort(); } catch (error) {} });
  accountRequestControllers.clear();
  if (typeof voice !== "undefined" && voice.active) exitVoice();
  if (typeof activeLessonIntake !== "undefined" && activeLessonIntake?.requestAbort) activeLessonIntake.requestAbort.abort();
  if (typeof currentLessonId !== "undefined") currentLessonId = null;
  cloudSyncReady = false;identityMutationReady = false;accountOwnershipResolved = false;
  cloudHydrating = false;cloudRemoteBaseline = "unknown";cloudRemoteRevision = 0;cloudSyncedFingerprint = "";
  backendEntitled = false;backendAccessRowPresent = false;backendEntitlementRecord = null;
  backendPilotLessonsUsed = null;backendPilotLessonsRemaining = null;backendPilotRegisteredLessonIds = new Set();
  cloudAccount = null;pendingLegacyRecovery = null;
  accountSaveStatus = "checking";
  accountSyncConflict = false;
  state.developerMode = false;state.developerUnlocked = false;
  clearLocalAccountView();
  syncDeveloperLauncherVisibility();
  syncDeveloperSettingsVisibility();
}
const DEVICE_ACCOUNTS_KEY = "worldview-device-accounts-v1";
let deviceAccountAddingFrom = "";
function readDeviceAccounts() {
  try {
    const rows = JSON.parse(localStorage.getItem(DEVICE_ACCOUNTS_KEY) || "[]");
    return Array.isArray(rows) ? rows.filter(row => row && typeof row.id === "string" && typeof row.email === "string"
      && typeof row.access_token === "string" && typeof row.refresh_token === "string") : [];
  } catch (_) { return []; }
}
function writeDeviceAccounts(rows) {
  const value = JSON.stringify(rows);
  localStorage.setItem(DEVICE_ACCOUNTS_KEY,value);
  if (localStorage.getItem(DEVICE_ACCOUNTS_KEY) !== value) throw new Error("device_account_storage");
}
function rememberDeviceSession(session) {
  if (!session?.user || !permanentAccountVerified(session.user) || !session.access_token || !session.refresh_token) return false;
  try {
    const rows = readDeviceAccounts().filter(row => row.id !== session.user.id);
    rows.unshift({id:session.user.id,email:session.user.email,access_token:session.access_token,refresh_token:session.refresh_token});
    writeDeviceAccounts(rows);
    return true;
  } catch (_) { return false; }
}
function forgetDeviceAccount(id) {
  writeDeviceAccounts(readDeviceAccounts().filter(row => row.id !== id));
}
async function preserveDeviceAccount() {
  await preserveCurrentAccountBeforeSwitch();
  if (cloudAccount?.is_anonymous) { await preserveAnonymousAccount(cloudAccount);return; }
  if (!permanentAccountVerified()) return;
  const result = await accountOperationDeadline(backendClient.auth.getSession());
  if (result.error || result.data?.session?.user?.id !== cloudAccount.id || !rememberDeviceSession(result.data.session)) {
    throw new Error("device_account_storage");
  }
}
function renderDeviceAccounts() {
  const section = $("device-accounts"), list = $("device-account-list");
  if (!section || !list) return;
  const show = ["manage","signin"].includes(passwordAccountMode) && !accountRecoveryRequired();
  section.hidden = !show;
  if (!show) return;
  list.replaceChildren();
  const rows = readDeviceAccounts();
  for (const row of rows) {
    const current = row.id === cloudAccount?.id && permanentAccountVerified();
    if (current && passwordAccountMode === "manage") continue; // Already shown in the identity card.
    const item = document.createElement("div");item.className = "device-account-row";
    const button = document.createElement("button");button.type = "button";button.textContent = row.email;
    const caption = document.createElement("small");caption.textContent = current ? "Current account" : "Switch account";button.append(caption);
    button.disabled = current || passwordAccountBusy;
    button.onclick = () => switchDeviceAccount(row.id);
    item.append(button);
    if (!current) {
      const remove = document.createElement("button");remove.type = "button";remove.textContent = "×";
      remove.setAttribute("aria-label",`Remove saved login for ${row.email}`);remove.disabled = passwordAccountBusy;
      remove.onclick = () => { try { forgetDeviceAccount(row.id);renderDeviceAccounts(); } catch (_) { passwordAccountNotice("Could not remove this saved login. Please try again.",true); } };
      item.append(remove);
    }
    list.append(item);
  }
  $("device-account-add").hidden = passwordAccountMode !== "manage";
  $("device-account-add").disabled = passwordAccountBusy;
  if (!rows.length && passwordAccountMode !== "manage") section.hidden = true;
}
async function addDeviceAccount() {
  if (passwordAccountBusy || accountTransitionInProgress || accountRecoveryRequired()) return;
  passwordAccountBusy = true;renderPasswordAccount();
  try {
    await preserveDeviceAccount();
    deviceAccountAddingFrom = cloudAccount?.id || "";
    setAccountPending(null);
    passwordAccountBusy = false;
    openPasswordAccount("signin","Sign in to another account. This account stays saved on this device.");
    $("password-account-email").value = "";
  } catch (_) { passwordAccountNotice("This device could not save your current login. You are still signed in; try again.",true); }
  finally { passwordAccountBusy = false;renderPasswordAccount(); }
}
async function switchDeviceAccount(id) {
  if (!backendClient || passwordAccountBusy || accountTransitionInProgress || accountRecoveryRequired()) return;
  const target = readDeviceAccounts().find(row => row.id === id);
  if (!target || (cloudAccount?.id === id && permanentAccountVerified())) return;
  passwordAccountBusy = true;accountTransitionInProgress = true;renderPasswordAccount();
  let suspended = false, success = false, restored = false, previous = null;
  try {
    await preserveDeviceAccount();
    previous = readDeviceAccounts().find(row => row.id === cloudAccount?.id) || null;
    suspendAccountIdentity();suspended = true;
    const result = await accountAuthCommand(() => backendClient.auth.setSession({access_token:target.access_token,refresh_token:target.refresh_token}));
    if (result.error) throw result.error;
    const verified = await accountOperationDeadline(backendClient.auth.getUser());
    if (verified.error || verified.data?.user?.id !== id || !permanentAccountVerified(verified.data?.user)) throw new Error("account_verification");
    if (!rememberDeviceSession({...result.data?.session,user:verified.data.user})) throw new Error("device_account_storage");
    localStorage.removeItem(ACCOUNT_SIGNOUT_KEY);setAccountPending(null);markPasswordRecovery("");
    deviceAccountAddingFrom = "";passwordAccountMode = "signin";passwordAccountNotice("");success = true;
  } catch (_) {
    if (suspended) {
      // Never show the prior library under an uncertain replacement session.
      suspendAccountIdentity();identityRestoreStatus = "signed-out";accountCacheReadOnly = false;
      if (previous) {
        try {
          const rollback = await accountAuthCommand(() => backendClient.auth.setSession({access_token:previous.access_token,refresh_token:previous.refresh_token}));
          const verified = await accountOperationDeadline(backendClient.auth.getUser());
          restored = !rollback.error && !verified.error && verified.data?.user?.id === previous.id && permanentAccountVerified(verified.data.user);
          if (restored) rememberDeviceSession(rollback.data?.session);
        } catch (_) {}
      }
      if (!restored) { try { await accountAuthCommand(() => backendClient.auth.signOut({scope:"local"})); } catch (_) {} }
      deviceAccountAddingFrom = restored ? previous.id : "";
      $("password-account-email").value = target.email;passwordAccountMode = "signin";
    }
    passwordAccountNotice(suspended ? "This saved login needs a fresh sign-in. Enter your password, or choose another saved account." : "Your current login could not be saved. You are still in the same account; try again.",true);
  } finally {
    accountTransitionInProgress = false;passwordAccountBusy = false;
    if (success) { await refreshPasswordAccountIdentity();reconcileAccountEntry();finishIdentityBootstrap(); }
    else {
      if (restored) await refreshPasswordAccountIdentity();
      openPasswordAccount(suspended ? "signin" : "manage",passwordAccountMessage,true);
    }
    renderPasswordAccount();
  }
}

async function preserveCurrentAccountBeforeSwitch() {
  // A failed local save must not destroy the only recoverable old-account copy.
  if (stateAccountId && cloudAccount?.id === stateAccountId) writeLocalState();
  if (cloudSyncReady) {
    try { await accountOperationDeadline(cloudSyncNow()); }
    catch (error) { /* The protected old-account device snapshot remains. */ }
  }
}
function anonymousLibraryNeedsProtection(user = cloudAccount) {
  // Anonymous credentials cannot be recovered by email yet. Retaining a UUID
  // cache alone is not a usable backup once its sole login session is replaced.
  if (!user?.is_anonymous) return false;
  if (hasLearnerLibrary(state) || hasLegacyLearnerData(state)) return true;
  try {
    // Lab saves share this origin/session but do not necessarily populate Home.
    return ["worldview-owner-lab-workspace-v1:","worldview-lab-clarification-v1:","worldview-account-state-v1:"]
      .some(prefix => !!localStorage.getItem(prefix + user.id));
  } catch (_) { return true; }
}
async function preserveAnonymousAccount(user) {
  // Preserve the existing SDK session before replacement, never the entered
  // password. This stays on this device, outside cloud/export/diagnostic data.
  // Signing in does not revoke this older session; anonymous sign-out is barred.
  await preserveCurrentAccountBeforeSwitch();
  const result = await backendClient.auth.getSession();
  const session = result.data?.session;
  if (result.error || session?.user?.id !== user.id || !session.access_token || !session.refresh_token) {
    throw new Error("anonymous_library_unprotected");
  }
  const key = "worldview-earlier-account-v1:" + user.id;
  const value = JSON.stringify({version:1,userId:user.id,savedAt:Date.now(),session});
  try {
    localStorage.setItem(key,value);
    if (localStorage.getItem(key) !== value) throw new Error("storage_write_failed");
  } catch (_) { throw new Error("anonymous_library_unprotected"); }
}
async function submitPasswordAccount() {
  if (passwordAccountBusy || !backendClient) return;
  const mode = passwordAccountMode === "verify" && accountPending?.mode !== "email_change" ? "signin" : passwordAccountMode;
  if (mode === "verify") { await checkAccountConfirmation();return; }
  if (!["signin","signup","upgrade","reset","update"].includes(mode)) return;
  const email = $("password-account-email").value.trim().toLowerCase();
  let password = $("password-account-secret").value;
  const confirmation = $("password-account-confirm").value;
  if (mode !== "update" && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    passwordAccountNotice("Enter a valid email address.",true);return;
  }
  if (["signin","signup","update"].includes(mode) && !password) { passwordAccountNotice("Enter your password.",true);return; }
  if (["signup","update"].includes(mode) && password.length < 12) { passwordAccountNotice("Use at least 12 characters for a new password.",true);return; }
  if (["signup","update"].includes(mode) && password !== confirmation) { passwordAccountNotice("The passwords do not match.",true);return; }
  let original = cloudAccount;
  passwordAccountBusy = true;
  accountTransitionInProgress = true;
  passwordAccountNotice("Working…");
  renderPasswordAccount();
  try {
    original = await cloudUser();
    if (["signin","signup","reset"].includes(mode) && original?.is_anonymous) await preserveAnonymousAccount(original);
    if (["signin","upgrade","signup"].includes(mode)) await preserveCurrentAccountBeforeSwitch();
    if (mode === "reset") {
      const result = await accountAuthCommand(() => backendClient.auth.resetPasswordForEmail(email,{redirectTo:accountEmailRedirect()}));
      if (result.error) throw result.error;
      passwordAccountNotice("If an account uses that email, a reset link is on its way. Check spam too.");
    } else if (mode === "upgrade") {
      if (!original?.is_anonymous || original.id !== cloudAccount?.id) throw new Error("The current account changed. Please check it and try again.");
      const result = await accountAuthCommand(() => backendClient.auth.updateUser({email,data:{worldview_password_setup:true}},{emailRedirectTo:accountEmailRedirect()}));
      if (result.error) throw result.error;
      if (result.data?.user?.id !== original.id) throw new Error("The original account could not be preserved. Please contact support before continuing.");
      setAccountPending({email,mode:"email_change",originalUserId:original.id,sentAt:Date.now()});
      passwordAccountMode = "verify";
      passwordAccountNotice("Confirmation sent. This device's library remains attached to its original account.");
    } else if (mode === "signup") {
      const result = await accountAuthCommand(() => backendClient.auth.signUp({email,password,options:{emailRedirectTo:accountEmailRedirect()}}));
      if (result.error) throw result.error;
      setAccountPending({email,mode:"signup",originalUserId:"",sentAt:Date.now()});
      passwordAccountMode = "verify";
      passwordAccountNotice("Check your email to confirm. If you already have an account, use Sign in or Forgot password.");
    } else if (mode === "update") {
      const verified = await cloudUser();
      if (!permanentAccountVerified(verified) || verified.id !== original?.id) throw new Error("That link is no longer valid. Request a new reset link.");
      const result = await accountAuthCommand(() => backendClient.auth.updateUser({password,data:{worldview_password_setup:false}}));
      if (result.error) throw result.error;
      if (result.data?.user?.id !== verified.id) throw new Error("The account changed. Sign in again to continue.");
      markPasswordRecovery("");
      setAccountPending(null);
      passwordAccountMode = "manage";
      passwordAccountNotice("Password saved. You will stay signed in on this device.");
    } else {
      const result = await accountAuthCommand(() => backendClient.auth.signInWithPassword({email,password}));
      if (result.error) throw result.error;
      if (!permanentAccountVerified(result.data?.user)) throw new Error("Confirm your email before signing in.");
      deviceAccountAddingFrom = "";
      localStorage.removeItem(ACCOUNT_SIGNOUT_KEY);
      markPasswordRecovery("");
      setAccountPending(null);
      passwordAccountMode = "signin";
      passwordAccountNotice("");
    }
  } catch (error) {
    // Do not display provider errors containing identities or login-existence details.
    const code = String(error?.code || "");
    const status = Number(error?.status || 0);
    if (mode === "signin" && code === "email_not_confirmed") {
      setAccountPending({email,mode:"signup",originalUserId:"",sentAt:Date.now()-60000});
      passwordAccountMode = "verify";
    }
    const message = error?.message === "anonymous_library_unprotected"
      ? "This device could not preserve its earlier account. Free some browser storage and try again. Your earlier work has not been removed."
      : mode === "signin" && ["invalid_credentials","user_not_found"].includes(code)
      ? "Email or password is incorrect."
      : code === "email_not_confirmed" ? "Confirm your email before signing in. You can resend the confirmation."
      : status === 429 || /rate|too many/i.test(error?.message || "") ? "Too many attempts. Wait a little before trying again."
      : mode === "upgrade" && /already|registered|exists|email_exists/i.test(code+" "+(error?.message || ""))
        ? "That email could not be linked. If it belongs to an existing account, ask for a library migration before switching. Your current library has not been moved or merged."
      : code === "weak_password" ? "Use a stronger password with at least 12 characters."
      : /expired|invalid.*(token|link)|session.*missing/i.test(code+" "+(error?.message || ""))
        ? "That link has expired or was already used. Request a new reset link."
      : "The account request could not finish. Check your connection and try again. No libraries were merged.";
    passwordAccountNotice(message,true);
  } finally {
    password = "";
    clearPasswordFields();
    accountTransitionInProgress = false;
    passwordAccountBusy = false;
    if (!["reset","upgrade"].includes(mode)) {
      await refreshPasswordAccountIdentity();
    }
    renderPasswordAccount();
    if (!passwordAccountError) {
      reconcileAccountEntry();
      if (permanentAccountVerified() && !accountRecoveryRequired() && ["signin","update"].includes(mode)) {
        closePasswordAccount();
        finishIdentityBootstrap();
      }
    }
  }
}
async function checkAccountConfirmation({silent = false} = {}) {
  if (passwordAccountBusy) return;
  passwordAccountBusy = true;renderPasswordAccount();
  try {
    await refreshPasswordAccountIdentity();
    if (accountPending?.mode === "email_change" && cloudAccount?.id !== accountPending.originalUserId) {
      throw new Error("The confirmation opened a different account. Your earlier library remains separate.");
    }
    if (permanentAccountVerified()) {
      if (cloudAccount.user_metadata?.worldview_password_setup || accountPending?.mode === "email_change") {
        markPasswordRecovery(cloudAccount.id);passwordAccountMode = "update";
      } else { setAccountPending(null);passwordAccountMode = "signin"; }
      passwordAccountNotice("");
    } else if (!silent) passwordAccountNotice("After confirming your email, enter your password to continue on this device.");
  } catch (error) { if (!silent) passwordAccountNotice("We could not verify this account yet. Your earlier library is still separate.",true); }
  finally { passwordAccountBusy = false;renderPasswordAccount();reconcileAccountEntry(); }
}
async function resendAccountConfirmation() {
  if (passwordAccountBusy || !accountPending) return;
  const pending = {...accountPending};
  passwordAccountBusy = true;renderPasswordAccount();
  try {
    if (Date.now() - Number(pending.sentAt || 0) < 60000) throw new Error("cooldown");
    let result;
    if (pending.mode === "email_change") {
      const current = await cloudUser();
      if (!current?.is_anonymous || current.id !== pending.originalUserId) throw new Error("identity");
      result = await accountAuthCommand(() => backendClient.auth.updateUser({email:pending.email},{emailRedirectTo:accountEmailRedirect()}));
    } else {
      result = await accountAuthCommand(() => backendClient.auth.resend({type:"signup",email:pending.email,options:{emailRedirectTo:accountEmailRedirect()}}));
    }
    if (result.error) throw result.error;
    setAccountPending({...pending,sentAt:Date.now()});
    passwordAccountNotice("If confirmation is needed, a new email is on its way.");
  } catch (error) {
    passwordAccountNotice(error?.message === "cooldown" ? "Wait one minute before requesting another email." : "The email could not be sent. Try later or sign in if already confirmed.",true);
  } finally { passwordAccountBusy = false;renderPasswordAccount(); }
}
async function signOutAccount() {
  if (!backendClient || passwordAccountBusy) return;
  // Revoking an anonymous session would invalidate its recovery credentials.
  if (anonymousLibraryNeedsProtection()) {
    passwordAccountNotice("Sign in to your account to continue. Earlier work will be kept separate on this device.",true);
    return;
  }
  passwordAccountBusy = true;
  let identitySuspended = false;
  try {
    await preserveCurrentAccountBeforeSwitch();
    const signoutId = cloudAccount?.id || authEventUserId;
    if (signoutId) forgetDeviceAccount(signoutId);
    if (signoutId) localStorage.setItem(ACCOUNT_SIGNOUT_KEY,JSON.stringify({userId:signoutId,startedAt:Date.now()}));
    accountTransitionInProgress = true;
    suspendAccountIdentity();
    identitySuspended = true;
    const result = await accountAuthCommand(() => backendClient.auth.signOut({scope:"local"}));
    if (result.error) throw result.error;
    localStorage.removeItem(ACCOUNT_SIGNOUT_KEY);
    setAccountPending(null);
    markPasswordRecovery("");
    identityRestoreStatus = "signed-out";accountCacheReadOnly = false;
    show("home");renderHome();renderProfile();
    passwordAccountMode = "signin";passwordAccountNotice("Signed out on this device. Your saved lessons were not deleted.");
  } catch (error) {
    passwordAccountNotice(identitySuspended
      ? "Sign-out could not be confirmed. This screen is locked; reconnect and retry."
      : "You are still signed in. This browser could not safely preserve your saved lessons before sign-out. Free some browser storage, then try again.",true);
  } finally {
    accountTransitionInProgress = false;passwordAccountBusy = false;
    updateCloudAccountUI();openPasswordAccount("signin",passwordAccountMessage,passwordAccountError);
  }
}
function handleAccountAuthChange(event, session) {
  const nextId = session?.user?.id || "";
  if (session && ["SIGNED_IN","INITIAL_SESSION","TOKEN_REFRESHED","USER_UPDATED"].includes(event)) rememberDeviceSession(session);
  const changed = !!((cloudAccount?.id || authEventUserId) && nextId !== (cloudAccount?.id || authEventUserId));
  if (event === "PASSWORD_RECOVERY" && nextId) markPasswordRecovery(nextId);
  if (event === "SIGNED_OUT" || changed || event === "PASSWORD_RECOVERY") {
    suspendAccountIdentity();
    identityRestoreStatus = event === "SIGNED_OUT" ? "signed-out" : "checking";
    accountCacheReadOnly = false;
    if (event === "SIGNED_OUT") { clearPasswordFields();setAccountPending(null); }
  }
  authEventUserId = nextId;
  // Never await Supabase APIs inside this callback: the SDK holds its auth lock.
  if (["SIGNED_IN","SIGNED_OUT","INITIAL_SESSION","USER_UPDATED","PASSWORD_RECOVERY","TOKEN_REFRESHED"].includes(event)) {
    setTimeout(async () => {
      if (accountTransitionInProgress || !initialIdentityRestored) return;
      await initCloudPersistence();
      reconcileAccountEntry();
    },0);
  }
}
$("password-account-form").addEventListener("submit",event => { event.preventDefault();submitPasswordAccount(); });
$("password-account-signup").onclick = () => openPasswordAccount("signup");
$("account-welcome-start").onclick = () => { dismissWelcome();openPasswordAccount("signup"); };
$("account-welcome-signin").onclick = () => { dismissWelcome();openPasswordAccount("signin"); };
$("password-account-signin").onclick = () => openPasswordAccount("signin");
$("password-account-forgot").onclick = () => openPasswordAccount("reset");
$("password-account-resend").onclick = resendAccountConfirmation;
$("password-account-close").onclick = closePasswordAccount;
$("password-account-back").onclick = () => {
  if (permanentAccountVerified() && !accountRecoveryRequired()) {
    if (passwordAccountMode === "manage") closePasswordAccount();
    else openPasswordAccount("manage");
  } else openPasswordAccount("signin");
};
// NAV-140: the Lab lives in the owner's account page, not on Home.
$("account-lab").onclick = () => { if (closePasswordAccount()) location.href = "lab/"; };
$("account-models").onclick = () => {
  if (!ownerToolsAvailable() || !aiAvailable() || !closePasswordAccount()) return;
  renderModelsSheet();
  $("models-sheet").classList.add("open");
  $("models-sheet").setAttribute("aria-hidden","false");
};
$("device-account-add").onclick = addDeviceAccount;
$("account-password").onclick = () => { if (permanentAccountVerified()) openPasswordAccount("update"); };
/* BUS-050: permanent account deletion. The server deletes the account and
   everything it owns only after the learner types DELETE; this device then
   forgets that account's saved copies and returns to sign-in. */
$("account-delete").onclick = () => { if (permanentAccountVerified()) openAccountDeletion(); };
function openAccountDeletion() {
  let dialog = $("account-delete-dialog");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "account-delete-dialog";
    dialog.setAttribute("aria-labelledby","account-delete-title");
    dialog.innerHTML = `<h2 id="account-delete-title">Delete your account?</h2>
      <p>This permanently deletes your Worldview account and everything saved with it: lessons, lesson maps, conversations, progress and Notes. It cannot be undone.</p>
      <label for="account-delete-confirm">Type DELETE to confirm</label>
      <input id="account-delete-confirm" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false">
      <p id="account-delete-status" role="status" aria-live="polite"></p>
      <div class="account-delete-actions"><button id="account-delete-cancel" type="button">Keep my account</button><button id="account-delete-go" type="button" disabled>Delete permanently</button></div>`;
    document.body.append(dialog);
    const field = $("account-delete-confirm"), go = $("account-delete-go");
    field.addEventListener("input",() => { go.disabled = field.value.trim() !== "DELETE"; });
    $("account-delete-cancel").onclick = () => dialog.close();
    go.onclick = () => void confirmAccountDeletion();
  }
  $("account-delete-confirm").value = "";$("account-delete-go").disabled = true;$("account-delete-status").textContent = "";
  dialog.showModal();$("account-delete-confirm").focus();
}
async function confirmAccountDeletion() {
  const go = $("account-delete-go"), status = $("account-delete-status"), ownerId = cloudAccount?.id || "";
  if (!ownerId || go.disabled) return;
  go.disabled = true;$("account-delete-cancel").disabled = true;status.textContent = "Deleting your account…";
  try {
    const response = await backendFetch("account-delete",{headers:{"content-type":"application/json"},body:JSON.stringify({confirm:"DELETE"}),signal:AbortSignal.timeout(30000)});
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.deleted !== true) throw new Error(payload?.error?.message || "Your account could not be deleted right now. Try again shortly.");
    // The account is gone on the server. Forget this device's copies of it.
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key && key.includes(ownerId)) keys.push(key); }
      for (const key of keys) localStorage.removeItem(key);
      forgetDeviceAccount(ownerId);
    } catch (_) { /* The server copy is already deleted. */ }
    try { await backendClient?.auth.signOut({scope:"local"}); } catch (_) { /* The session belongs to a deleted account. */ }
    status.textContent = "Your account and its data were deleted.";
    setTimeout(() => location.reload(), 1600);
  } catch (error) {
    status.textContent = error?.message || "Your account could not be deleted right now. Try again shortly.";
    go.disabled = $("account-delete-confirm").value.trim() !== "DELETE";$("account-delete-cancel").disabled = false;
  }
}
$("password-account-signout").onclick = signOutAccount;
$("account-dialog").addEventListener("cancel",event => { if (!closePasswordAccount()) event.preventDefault(); });
$("account-dialog").addEventListener("close",() => { clearPasswordFields();syncCredentialFieldInteractivity(); });
$("account-link").onclick = () => openPasswordAccount();
$("account-signout").onclick = signOutAccount;
window.addEventListener("storage",event => {
  if (event.key === ACCOUNT_SIGNOUT_KEY && accountSignoutPending()) {
    suspendAccountIdentity();identityRestoreStatus = "signed-out";accountCacheReadOnly = false;
    show("home");renderHome();renderProfile();
    openPasswordAccount("signin","Sign-out was requested in another tab. This account stays locked until sign-out succeeds or you sign in again.");
    return;
  }
  if (event.key === PASSWORD_RECOVERY_KEY) {
    passwordRecoveryUserId = "";
    if (accountRecoveryRequired()) { identityMutationReady = false;syncDeveloperLauncherVisibility();openPasswordAccount("update"); }
    else if (!accountTransitionInProgress) initCloudPersistence().then(reconcileAccountEntry);
  }
});
syncDeveloperSettingsVisibility();
$("set-theme").addEventListener("change",event => { state.theme = event.target.value;applyTheme();save(); });
function setSettingsInteractive(active) {
  const settings = $("settings");
  if (!active && document.activeElement && settings.contains(document.activeElement)) {
    try { document.activeElement.blur(); } catch (error) {}
  }
  settings.inert = !active;
  settings.setAttribute("aria-hidden",active ? "false" : "true");
  syncCredentialFieldInteractivity();
}
setSettingsInteractive(false);
$("settings").addEventListener("toggle",syncCredentialFieldInteractivity,true);
let settingsReturnToAccount = false;
function openSettings(origin = "") {
  settingsReturnToAccount = origin === "account";
  setSettingsInteractive(true);
  $("set-testercode").value = state.testerInvite || "";
  $("set-elkey").value = state.elKey || "";
  $("set-cartkey").value = state.cartKey || "";
  $("set-cartvoice").value = state.cartVoice || "";
  $("set-deepgramkey").value = state.deepgramKey || "";
  $("set-deepgrammodel").value = state.deepgramModel || "aura-2-arcas-en";
  $("set-ttsprovider").value = state.ttsProvider || "auto";
  $("set-model").value = state.model;
  $("set-thinking").value = state.tutorThinking || "fast";
  $("set-theme").value = state.theme || "system";
  $("set-speechlanguage").value = speechLanguageCode();
  $("set-voicedefault").checked = !!state.voiceDefault;
  $("set-developer").checked = !!state.developerMode;
  $("open-mic-primer").textContent = state.micPrimerVersion === MIC_PRIMER_VERSION ? "Review" : "Set up";
  syncDeveloperSettingsVisibility();
  updateCloudAccountUI();
  $("settings").classList.add("open");
  syncCredentialFieldInteractivity();
  $("settings-panel").scrollTop = 0; // always open showing the top
  settingsSnap = settingsFields();
}
// The top-left profile mark shows who is signed in on this device at a
// glance and opens the account dialog, which names the address in full.
function renderHomeAccount() {
  const el = document.getElementById("home-account");
  if (!el) return;
  const email = String(cloudAccount?.email || "").trim();
  const avatar = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 12.6a4.8 4.8 0 1 0 0-9.6 4.8 4.8 0 0 0 0 9.6Zm0 1.9c-4.3 0-7.8 2.5-7.8 5.6V21h15.6v-.9c0-3.1-3.5-5.6-7.8-5.6Z"/></svg>';
  if (email) el.textContent = email[0];
  else el.innerHTML = avatar;
  el.title = email ? `Signed in as ${email}` : "Not signed in \u2014 tap to sign in";
  el.classList.toggle("signed-out", !email);
}
function openAccountSettings() {
  if ($("intro-demo").classList.contains("open")) setIntroOpen(false,false);
  closeDrawer();
  openPasswordAccount();
}
$("gear").onclick = openSettings;
$("home-account").onclick = openAccountSettings;
/* BUS-061: a signed-in learner without access types the tester code on their
   account page. Settings is no longer reachable from Home (NAV-140), and saved
   voice lessons need an access row on the server, so the code is checked and
   claimed right away rather than waiting for a first tutor request.
   lesson-metrics runs requireTesterAccess before it reads its request: an empty
   POST claims the row when the code is right (the server then answers
   invalid_metric and records nothing) and answers access_denied when it is not.
   var, not let: updateCloudAccountUI can render this before the line runs. */
var accessClaimBusy = false, accessClaimTriedFor = "", accessClaimSucceededFor = "";
function setAccessNote(text, kind = "") {
  const note = $("account-access-note");
  if (!note) return;
  note.textContent = text;
  if (kind) note.dataset.state = kind; else delete note.dataset.state;
}
function accessCodeWanted() {
  return !!(backendClient && permanentAccountVerified() && !accountRecoveryRequired()
    && cloudAccount && entitlementAccountId === cloudAccount.id && !backendAccessRowPresent);
}
function renderAccountAccess() {
  const box = $("account-access");
  if (!box) return;
  const wanted = accessCodeWanted();
  // Right after a successful unlock the box stays to say so, without the field.
  const unlocked = !wanted && !!cloudAccount && accessClaimSucceededFor === cloudAccount.id;
  box.hidden = !wanted && !unlocked;
  box.querySelector("label").hidden = unlocked;
  box.querySelector(".account-access-row").hidden = unlocked;
  $("account-access-unlock").disabled = accessClaimBusy;
  $("account-access-code").disabled = accessClaimBusy;
  // A code from an invite link is claimed once per account, without a tap.
  const linkCode = state.testerInvite || pendingInviteCode;
  if (wanted && linkCode && !accessClaimBusy && accessClaimTriedFor !== cloudAccount.id) {
    accessClaimTriedFor = cloudAccount.id;
    void claimAccessCode(linkCode,{quiet:true});
  }
}
async function claimAccessCode(raw, {quiet = false} = {}) {
  const code = String(raw || "").trim();
  if (!code) { setAccessNote("Type the code first.","error");$("account-access-code").focus();return false; }
  if (accessClaimBusy || !accessCodeWanted()) return false;
  const userId = cloudAccount.id;
  accessClaimBusy = true;renderAccountAccess();
  if (!quiet) setAccessNote("Checking the code…");
  try {
    const token = await backendAccessToken(false);
    const response = await fetch(`${SUPABASE_URL}/functions/v1/lesson-metrics`,{
      method:"POST",
      headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${token}`,"content-type":"application/json","x-worldview-access":code},
      body:"{}",signal:AbortSignal.timeout(15000),
    });
    const type = String((await response.json().catch(() => null))?.error?.type || "");
    if (cloudAccount?.id !== userId) return false;
    if (response.status === 400 && type === "invalid_metric") {
      state.testerInvite = code;save();
      accessClaimSucceededFor = userId;
      await loadBackendEntitlement(userId);
      if (cloudAccount?.id !== userId) return false;
      $("account-access-code").value = "";
      setAccessNote("You're in. Close this and start a lesson.","ok");
      toast("Access unlocked. You can start lessons now.",4500);
      return true;
    }
    // A wrong code from an old link is forgotten, so the field shows instead.
    if (type === "access_denied") { if (state.testerInvite === code) { state.testerInvite = "";save(); } if (pendingInviteCode === code) pendingInviteCode = ""; }
    if (quiet) return false;
    setAccessNote(type === "access_denied" ? "That code didn't work. Check it and try again."
      : ["access_revoked","access_expired","access_invalid"].includes(type) ? "Access for this account is switched off."
      : type === "not_configured" ? "Access codes aren't set up yet."
      : "Couldn't check the code right now. Try again in a moment.","error");
    return false;
  } catch (_) {
    if (!quiet) setAccessNote("Couldn't reach Worldview. Check your connection and try again.","error");
    return false;
  } finally {
    accessClaimBusy = false;
    updateCloudAccountUI();
  }
}
function openAccessCode(message = "") {
  if (!permanentAccountVerified()) { openAccountSettings();return; }
  openPasswordAccount("manage");
  renderAccountAccess();
  if (message && accessCodeWanted()) setAccessNote(message);
  if (innerWidth > 700 && accessCodeWanted()) $("account-access-code").focus();
}
$("account-access-unlock").onclick = () => { void claimAccessCode($("account-access-code").value); };
$("account-access-code").addEventListener("keydown",event => {
  if (event.key !== "Enter") return;
  event.preventDefault();void claimAccessCode($("account-access-code").value);
});
renderHomeAccount();
// dirty = fields changed since the panel was OPENED (comparing against saved
// state broke on the phone: a laptop-chosen voice doesn't exist in the phone's
// voice list, which made every close look like an unsaved change)
let settingsSnap = "";
function settingsFields() {
  return JSON.stringify([$("set-testercode").value.trim(), $("set-elkey").value.trim(), $("set-cartkey").value.trim(), $("set-cartvoice").value.trim(), $("set-deepgramkey").value.trim(), $("set-deepgrammodel").value, $("set-ttsprovider").value, $("set-model").value, $("set-thinking").value, $("set-speechlanguage").value, $("set-voicedefault").checked, $("set-developer").checked]);
}
function settingsDirty() { return settingsFields() !== settingsSnap; }
function applySettings() {
  state.testerInvite = $("set-testercode").value.trim();
  state.elKey = $("set-elkey").value.trim();
  state.cartKey = $("set-cartkey").value.trim();
  state.cartVoice = $("set-cartvoice").value.trim();
  state.deepgramKey = $("set-deepgramkey").value.trim();
  state.deepgramModel = $("set-deepgrammodel").value || "aura-2-arcas-en";
  state.ttsProvider = $("set-ttsprovider").value || "auto";
  elBroken = false; cartBroken = false; deepgramBroken = false; // new keys → give the premium voices a fresh chance
  state.model = $("set-model").value;
  state.tutorThinking = $("set-thinking").value || "fast";
  state.theme = $("set-theme").value || "system";
  state.speechLanguage = "en";
  state.voiceDefault = $("set-voicedefault").checked;
  // Production is always learner-facing. Developer controls are available
  // only from an explicit ?developer=1 owner link and never from Settings.
  state.developerMode = !!(state.developerUnlocked && $("set-developer").checked);
  voice.forceLocal = false; // a new voice choice clears any local-only fallback
  save();
  applyTheme();
}
// leaving without the Save button (backdrop tap or swipe-down) offers to keep changes
function closeSettings(askSave, returnToAccount = false) {
  if (askSave && settingsDirty() && confirm("Save your changes?")) {
    applySettings();
    toast("Saved");
  }
  $("settings").classList.remove("open");
  setSettingsInteractive(false);
  const returnTo = settingsReturnToAccount;settingsReturnToAccount = false;
  if (returnToAccount && returnTo) openPasswordAccount();
}
$("settings").addEventListener("click", e => { if (e.target === $("settings")) closeSettings(true); });
/* Build badge + What's New. The VERSIONS array has been maintained for many
   releases but was never rendered anywhere, so the one thing that could have
   settled several "it isn't fixed yet" reports — which build the phone is
   actually running — was invisible. */
if ($("home-build")) {
  $("home-build").textContent = BUILD;
  $("home-build").addEventListener("click", () => {
    $("version-now").textContent = "You are running " + BUILD + ".";
    $("version-list").innerHTML = VERSIONS.map(entry =>
      `<div class="version-entry"><h3>${escapeHtml(entry.tag)} &middot; ${escapeHtml(entry.date)}</h3><ul>`
      + entry.changes.map(change => `<li>${escapeHtml(change)}</li>`).join("")
      + `</ul></div>`).join("");
    $("version-sheet").classList.add("open");
    $("version-sheet").setAttribute("aria-hidden","false");
  });
}
function closeVersionSheet() {
  $("version-sheet").classList.remove("open");
  $("version-sheet").setAttribute("aria-hidden","true");
}
if ($("version-close")) $("version-close").addEventListener("click", closeVersionSheet);
/* Scroll up past the top of the sheet to dismiss it — the gesture the rest of
   the app already uses to leave a surface, rather than hunting for a button. */
if ($("version-sheet")) {
  const panel = $("version-sheet").querySelector(".version-panel");
  let startY = 0, pulling = false;
  panel.addEventListener("pointerdown", event => { startY = event.clientY; pulling = panel.scrollTop <= 0; });
  panel.addEventListener("pointermove", event => {
    if (!pulling) return;
    const drag = event.clientY - startY;
    if (drag < -70) { pulling = false; closeVersionSheet(); }
  });
  panel.addEventListener("pointerup", () => { pulling = false; });
  panel.addEventListener("pointercancel", () => { pulling = false; });
}
if ($("version-sheet")) $("version-sheet").addEventListener("click", event => { if (event.target === $("version-sheet")) closeVersionSheet(); });
if ($("models-button")) $("models-button").addEventListener("click", () => {
  if (!aiAvailable()) return;
  renderModelsSheet();
  $("models-sheet").classList.add("open");
  $("models-sheet").setAttribute("aria-hidden","false");
});
if ($("open-models")) $("open-models").addEventListener("click", () => {
  if (!aiAvailable()) return;
  renderModelsSheet();
  $("models-sheet").classList.add("open");
  $("models-sheet").setAttribute("aria-hidden","false");
});
function closeModelsSheet() {
  $("models-sheet").classList.remove("open");
  $("models-sheet").setAttribute("aria-hidden","true");
}
if ($("models-close")) $("models-close").addEventListener("click", closeModelsSheet);
if ($("models-sheet")) $("models-sheet").addEventListener("click", event => { if (event.target === $("models-sheet")) closeModelsSheet(); });
if ($("voice-speaker-button")) $("voice-speaker-button").addEventListener("click", event => { event.stopPropagation(); toggleSpeakerphone(); });
if ($("voice-timing-clear")) $("voice-timing-clear").addEventListener("click",() => { state.voiceTimingLog = []; save(); renderVoiceTimingReadout(); });
$("set-developer").addEventListener("change",event => {
  if (!ownerToolsAvailable()) { event.target.checked = false;return; }
  state.developerMode = !!event.target.checked;
  save();
  syncDeveloperLauncherVisibility();
  syncDeveloperSettingsVisibility();
  renderConversationModelSwitches();
});
(function settingsSwipe() { // mobile: swipe down on the panel to leave settings
  const panel = $("settings-panel");
  let sx = 0, sy = 0, atTop = true;
  panel.addEventListener("touchstart", e => {
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    atTop = panel.scrollTop <= 0;
  }, { passive: true });
  panel.addEventListener("touchend", e => {
    const t = e.changedTouches[0];
    if (!atTop || panel.scrollTop > 0) return; // they were scrolling the panel's content
    if (t.clientY - sy > 130 && Math.abs(t.clientX - sx) < 70) closeSettings(true);
  }, { passive: true });
})();
$("settings-save").onclick = () => {
  applySettings();
  $("settings").classList.remove("open");
  setSettingsInteractive(false);
  toast("Saved");
};
