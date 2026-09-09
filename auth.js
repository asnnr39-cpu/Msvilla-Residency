// ms-villa-app / js/auth.js
//
// Login (username/password and mobile OTP), session handling, and the
// change-password screen. Depends on globals defined in database.js
// (state, $, app, heroWrap, HOUSE_ICON, sset) and calls
// askToEnableNotifications() from notifications.js right after a
// successful sign-in.

function renderLogin(){
  const options = state.members.map(m=>`<option value="${m.username}">${m.username}</option>`).join("");
  const standaloneNote = navigator.onLine ? "" : `<div class="instr-note" style="margin:0 18px 18px;">You're offline right now — showing the last data saved on this device.</div>`;
  app.innerHTML = `
    ${heroWrap("living", `
      <div class="crest">
        <img class="crest-logo" src="./logo.png" alt="Ms Villa">
        <div class="sub">Resident Portal</div>
        <div class="dots"><span></span><span></span><span></span><span></span><span></span></div>
      </div>
    `)}
    ${standaloneNote}
    <div class="card">
      <label>Select your username</label>
      <select id="login-user">${options}</select>
      <label>Password</label>
      <input type="password" id="login-pass" placeholder="Enter password">
      <div class="error" id="login-error" style="display:none;"></div>
      <button class="btn-primary" id="login-btn">Sign In</button>
    </div>
    <div class="foot-note">First time signing in? Your password is <b style="color:var(--accent)">Msvilla@202</b> — change it after logging in.</div>
    <div class="foot-note" style="margin-top:6px;">Or <span data-nav="phoneLogin" style="color:var(--accent); cursor:pointer;">sign in with your mobile number (OTP)</span>.</div>
    <div class="foot-note" style="margin-top:6px;">On iPhone: open this page in Safari, tap Share, then "Add to Home Screen" for an app-like icon.</div>
  `;
  $("#login-btn").onclick = ()=>{
    const u = $("#login-user").value;
    const p = $("#login-pass").value;
    const member = state.members.find(m=>m.username===u);
    if(member && member.password===p){
      state.session = { username: u };
      state.view = "home";
      render();
      askToEnableNotifications();
    } else {
      const err = $("#login-error");
      err.style.display = "block";
      err.textContent = "Incorrect password. Please try again.";
    }
  };
}


function renderPhoneLogin(){
  app.innerHTML = `
    ${heroWrap("living", `
      <div class="crest">
        <img class="crest-logo" src="./logo.png" alt="Ms Villa">
        <div class="sub">Sign in with mobile number</div>
      </div>
    `)}
    <div class="card">
      <label>Mobile number</label>
      <input type="text" id="otp-phone" placeholder="+91 98765 43210">
      <div class="error" id="otp-error" style="display:none;"></div>
      <div class="msg" id="otp-msg" style="display:none;"></div>
      <button class="btn-primary" id="otp-send">Send OTP</button>
      <div id="otp-verify-block" style="display:none; margin-top:16px;">
        <label>Enter the 6-digit code</label>
        <div class="otp-box"><input type="text" id="otp-code" maxlength="6"></div>
        <button class="btn-primary" id="otp-verify">Verify &amp; Sign In</button>
      </div>
    </div>
    <div class="foot-note">Prefer a password? <span data-nav="login" style="color:var(--accent); cursor:pointer;">Sign in with username</span></div>
  `;
  $("#otp-send").onclick = ()=>{
    const phone = $("#otp-phone").value.trim();
    const err = $("#otp-error"), msg = $("#otp-msg");
    err.style.display="none"; msg.style.display="none";
    const member = state.members.find(m=> m.phone && m.phone.replace(/\s/g,"") === phone.replace(/\s/g,""));
    if(!member){ err.style.display="block"; err.textContent="No resident is linked to that number yet. Ask an admin to add it in Settings."; return; }
    const code = String(Math.floor(100000 + Math.random()*900000));
    state.pendingOtp = { phone, code, username: member.username, expiresAt: Date.now() + 5*60*1000 };
    msg.style.display="block";
    msg.textContent = `Demo mode: no SMS provider is connected, so your code is ${code}. It expires in 5 minutes.`;
    $("#otp-verify-block").style.display = "block";
  };
  $("#otp-verify").onclick = ()=>{
    const err = $("#otp-error");
    err.style.display="none";
    const entered = $("#otp-code").value.trim();
    const p = state.pendingOtp;
    if(!p || Date.now() > p.expiresAt){ err.style.display="block"; err.textContent="Code expired. Send a new one."; return; }
    if(entered !== p.code){ err.style.display="block"; err.textContent="That code doesn't match."; return; }
    state.session = { username: p.username };
    state.pendingOtp = null;
    state.view = "home";
    render();
    askToEnableNotifications();
  };
}


function renderChangePass(){
  app.innerHTML = `
    ${topbar("Change Password","settings")}
    ${heroWrap("living", `
      <div class="house-title" style="padding-top:0;">
        <h1 style="font-size:26px;">Change Password</h1>
      </div>
    `)}
    <div class="card">
      <label>Current password</label>
      <input type="password" id="cur-pass">
      <label>New password</label>
      <input type="password" id="new-pass">
      <label>Confirm new password</label>
      <input type="password" id="confirm-pass">
      <div class="error" id="cp-error" style="display:none;"></div>
      <div class="msg" id="cp-msg" style="display:none;"></div>
      <button class="btn-primary" id="save-pass">Save New Password</button>
    </div>
  `;
  $("#save-pass").onclick = async ()=>{
    const me = state.members.find(m=>m.username===state.session.username);
    const cur = $("#cur-pass").value, np = $("#new-pass").value, cf = $("#confirm-pass").value;
    const err = $("#cp-error"), msg = $("#cp-msg");
    err.style.display="none"; msg.style.display="none";
    if(me.password !== cur){ err.style.display="block"; err.textContent="Current password is incorrect."; return; }
    if(np.length < 6){ err.style.display="block"; err.textContent="New password should be at least 6 characters."; return; }
    if(np !== cf){ err.style.display="block"; err.textContent="New passwords do not match."; return; }
    me.password = np;
    await sset("ms-villa:members", state.members);
    msg.style.display="block"; msg.textContent="Password updated.";
  };
}

// generic back-nav delegation
