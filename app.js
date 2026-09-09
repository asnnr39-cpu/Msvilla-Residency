// ms-villa-app / js/app.js
//
// Core render engine (view router, back-button history handling), the
// "Chat with us" WhatsApp FAB, and every non-admin, non-auth screen: home,
// a room's attendance sheet, house instructions, duty roster, room
// expenses/ledger, rent info, complaints, and meetings. Also owns the
// generic [data-nav] click delegation, the periodic background sync
// against the shared data store, and app startup (init).
//
// Depends on globals from database.js (state, $, app, ICONS, IMAGES,
// helpers, storage functions) and calls into auth.js / admin.js /
// notifications.js for screens and actions those files own.

let lastPushedView = null;

// Safe fallbacks for deployments where auth/admin/notifications scripts were
// omitted. The old startup path would otherwise throw before rendering anything.
function ensureAppRoot(){
  if(typeof getApp === "function") app = getApp();
  if(!app) app = document.querySelector("#app");
  return app;
}
if(typeof window.renderLogin !== "function") window.renderLogin = function(){
  const root=ensureAppRoot(); if(!root) throw new Error("Missing #app element in index.html");
  root.innerHTML=`<div class="card" style="max-width:420px;margin:48px auto;padding:24px;"><h1 style="margin-top:0;">Ms Villa</h1><div class="foot-note" style="margin-bottom:18px;">Sign in to continue</div><label>Username</label><input id="login-user" type="text" autocomplete="username" placeholder="e.g. Narendra@35"><label>Password</label><input id="login-pass" type="password" autocomplete="current-password" placeholder="Password"><div class="error" id="login-error" style="display:none;margin:10px 0;"></div><button class="btn-primary" id="login-btn" style="width:100%;">Sign In</button><button class="btn-ghost" id="phone-login-btn" style="width:100%;margin-top:8px;">Use phone login</button></div>`;
  const login=async()=>{const username=root.querySelector("#login-user").value.trim(),password=root.querySelector("#login-pass").value,member=state.members.find(m=>m.username.toLowerCase()===username.toLowerCase()),err=root.querySelector("#login-error");if(!member||password!==(member.password||DEFAULT_PASSWORD)){err.textContent="Invalid username or password.";err.style.display="block";return;}state.session={username:member.username};try{localStorage.setItem("ms-villa:session",JSON.stringify(state.session));}catch(e){}state.view="home";render();};
  root.querySelector("#login-btn").onclick=login; root.querySelector("#login-pass").onkeydown=e=>{if(e.key==="Enter")login()}; root.querySelector("#phone-login-btn").onclick=()=>{state.view="phoneLogin";render()};
};
if(typeof window.renderPhoneLogin !== "function") window.renderPhoneLogin=function(){const root=ensureAppRoot();root.innerHTML=`<div class="card" style="max-width:420px;margin:48px auto;padding:24px;"><h2>Phone Login</h2><div class="foot-note">Phone/OTP login is unavailable because auth.js is not loaded.</div><button class="btn-primary" id="back-login" style="width:100%;margin-top:14px;">Back to Password Login</button></div>`;root.querySelector("#back-login").onclick=()=>{state.view="login";render()};};
if(typeof window.renderChangePass !== "function") window.renderChangePass=function(){const root=ensureAppRoot(),me=state.members.find(m=>m.username===state.session?.username);root.innerHTML=`<div class="card" style="max-width:420px;margin:48px auto;padding:24px;"><h2>Change Password</h2><label>Current password</label><input id="cp-old" type="password"><label>New password</label><input id="cp-new" type="password"><div class="error" id="cp-error" style="display:none;"></div><button class="btn-primary" id="cp-save" style="width:100%;">Save Password</button><button class="btn-ghost" id="cp-back" style="width:100%;margin-top:8px;">Back</button></div>`;root.querySelector("#cp-back").onclick=()=>{state.view="settings";render()};root.querySelector("#cp-save").onclick=async()=>{const err=root.querySelector("#cp-error");if(!me){err.textContent="You are not signed in.";err.style.display="block";return;}if(root.querySelector("#cp-old").value!==(me.password||DEFAULT_PASSWORD)){err.textContent="Current password is incorrect.";err.style.display="block";return;}const np=root.querySelector("#cp-new").value;if(np.length<6){err.textContent="New password must be at least 6 characters.";err.style.display="block";return;}me.password=np;await sset("ms-villa:members",state.members);alert("Password changed.");state.view="settings";render()};};
if(typeof window.notificationStatusLabel !== "function") window.notificationStatusLabel=()=>"Notifications module not loaded";
if(typeof window.notificationsEnabled !== "function") window.notificationsEnabled=()=>false;
if(typeof window.subscribeToPush !== "function") window.subscribeToPush=async()=>{};
if(typeof window.unsubscribeFromPush !== "function") window.unsubscribeFromPush=async()=>{};
if(typeof window.initNotifications !== "function") window.initNotifications=()=>{};
if(typeof window.notifyMembers !== "function") window.notifyMembers=()=>{};
if(typeof window.openEditDutyModal !== "function") window.openEditDutyModal=()=>alert("Admin tools are unavailable: admin.js is not loaded.");
if(typeof window.openEditExpensesModal !== "function") window.openEditExpensesModal=()=>alert("Admin tools are unavailable: admin.js is not loaded.");
if(typeof window.openAddMemberModal !== "function") window.openAddMemberModal=()=>alert("Admin tools are unavailable: admin.js is not loaded.");

// --- Room Expenses calendar (Daily Expenses) -------------------------------
// Transient UI state only (not persisted) — which month is showing and which
// date is selected in the "tap a date to see that day's expenses" calendar.
let expCalYear = null, expCalMonth = null, expSelectedDate = null;

function ensureExpensesCalendarStyles(){
  if(document.getElementById("expcal-styles")) return;
  const style = document.createElement("style");
  style.id = "expcal-styles";
  style.textContent = `
    .expcal-wrap{margin:0 18px 18px;}
    .expcal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
    .expcal-title{font-weight:600;font-size:15px;letter-spacing:.3px;}
    .expcal-nav{background:none;border:1px solid var(--border,rgba(255,255,255,.15));color:var(--text,#fff);border-radius:8px;width:32px;height:32px;font-size:15px;cursor:pointer;}
    .expcal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;}
    .expcal-dows{margin-bottom:4px;}
    .expcal-dow{text-align:center;font-size:11px;color:var(--muted,#9aa4b2);padding:2px 0;}
    .expcal-cell{position:relative;aspect-ratio:1/1;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:8px;background:rgba(255,255,255,.04);cursor:pointer;}
    .expcal-cell .d{font-size:13px;}
    .expcal-cell.dim{opacity:.35;}
    .expcal-cell.today .d{color:var(--accent,#4f8cff);font-weight:700;}
    .expcal-cell.sel{background:var(--accent,#4f8cff);}
    .expcal-cell.sel .d{color:#fff;font-weight:700;}
    .expcal-cell.sel.today .d{color:#fff;}
    .expcal-cell .dot{width:5px;height:5px;border-radius:50%;background:var(--accent,#4f8cff);margin-top:2px;}
    .expcal-cell.sel .dot{background:#fff;}
    .expcal-month-total{text-align:right;font-size:12px;color:var(--muted,#9aa4b2);margin-top:8px;}
    .expcal-agenda-head{display:flex;align-items:center;justify-content:space-between;padding:0 18px;margin-bottom:8px;}
    .expcal-agenda-date{display:flex;align-items:baseline;gap:8px;}
    .expcal-agenda-date .big{font-size:24px;font-weight:700;}
    .expcal-agenda-date .dow{font-size:11px;color:var(--muted,#9aa4b2);letter-spacing:1px;}
    .expcal-agenda-total{font-size:15px;font-weight:700;color:var(--accent,#4f8cff);}
  `;
  document.head.appendChild(style);
}

function buildExpensesCalendar(){
  const now = new Date();
  if(expCalYear===null){ expCalYear = now.getFullYear(); expCalMonth = now.getMonth(); }
  if(!expSelectedDate) expSelectedDate = todayLocalKey();

  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const first = new Date(expCalYear, expCalMonth, 1);
  const startOffset = (first.getDay()+6)%7; // Monday=0
  const daysInMonth = new Date(expCalYear, expCalMonth+1, 0).getDate();
  const rowCount = Math.ceil((startOffset+daysInMonth)/7);
  const gridStart = new Date(expCalYear, expCalMonth, 1-startOffset);
  const todayKeyLocal = todayLocalKey();

  let cells = "";
  for(let i=0;i<rowCount*7;i++){
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate()+i);
    const key = ymd(d);
    const inMonth = d.getMonth()===expCalMonth;
    const isToday = key===todayKeyLocal;
    const isSelected = key===expSelectedDate;
    const hasExpenses = dailyExpensesTotalFor(key) > 0;
    cells += `
      <div class="expcal-cell ${inMonth?'':'dim'} ${isToday?'today':''} ${isSelected?'sel':''}" data-cal-date="${key}">
        <div class="d">${d.getDate()}</div>
        ${hasExpenses ? `<div class="dot"></div>` : ``}
      </div>
    `;
  }

  const dowRow = ["M","T","W","T","F","S","S"].map(d=>`<div class="expcal-dow">${d}</div>`).join("");
  const monthTotal = dailyExpensesTotalForMonth(expCalYear, expCalMonth);

  return `
    <div class="expcal-wrap">
      <div class="expcal-header">
        <button type="button" class="expcal-nav" data-cal-nav="-1">&larr;</button>
        <div class="expcal-title">${MONTH_NAMES[expCalMonth]} ${expCalYear}</div>
        <button type="button" class="expcal-nav" data-cal-nav="1">&rarr;</button>
      </div>
      <div class="expcal-grid expcal-dows">${dowRow}</div>
      <div class="expcal-grid">${cells}</div>
      <div class="expcal-month-total">This month so far: <b>${inr(monthTotal)}</b></div>
    </div>
  `;
}

function buildExpensesAgenda(){
  const key = expSelectedDate;
  const d = new Date(key+"T00:00:00");
  const dayNum = d.getDate();
  const dowLabel = d.toLocaleDateString("en-IN", {weekday:"short"}).toUpperCase();
  const monthShort = d.toLocaleDateString("en-IN", {month:"short"});
  const entries = dailyExpensesFor(key);
  const me = state.members.find(m=>m.username===state.session.username);
  const rows = entries.map(e=>`
    <div class="member-row">
      <div class="left"><div class="avatar-empty">₹</div>
        <div>
          <div class="name">${e.label}</div>
          <div class="tag">Added by ${nameFor(e.addedBy, state.members)}</div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <b>${inr(e.amount)}</b>
        ${(me.admin || e.addedBy===state.session.username) ? `<span data-del-expense="${e.id}" style="color:var(--danger); cursor:pointer; font-size:11px;">Remove</span>` : ``}
      </div>
    </div>
  `).join("") || `<div class="foot-note" style="padding:16px 0;">No expenses logged for this day yet.</div>`;
  const total = dailyExpensesTotalFor(key);

  return `
    <div class="expcal-agenda">
      <div class="expcal-agenda-head">
        <div class="expcal-agenda-date"><span class="big">${dayNum}</span><span class="dow">${dowLabel}</span></div>
        ${entries.length ? `<div class="expcal-agenda-total">${inr(total)}</div>` : ``}
      </div>
      <div class="card" style="padding:6px 18px;">${rows}</div>
      <div class="nav-row"><button class="btn-primary" id="add-daily-expense" style="flex:1;">+ Add expense for ${dayNum} ${monthShort}</button></div>
    </div>
  `;
}

function openAddExpenseModal(dateKey){
  const d = new Date(dateKey+"T00:00:00");
  const label = d.toLocaleDateString("en-IN", {day:"numeric", month:"long", year:"numeric"});
  const wrap = document.createElement("div");
  wrap.className = "modal-bg";
  wrap.innerHTML = `
    <div class="modal">
      <h3>Add Expense — ${label}</h3>
      <label>What was it for?</label>
      <input type="text" id="de-label" placeholder="e.g. Vegetables, Gas cylinder, Milk">
      <label>Amount (₹)</label>
      <input type="number" id="de-amount" placeholder="0" inputmode="decimal">
      <div class="error" id="de-error" style="display:none;"></div>
      <button class="btn-primary" id="de-save">Save Expense</button>
      <button class="btn-ghost" id="de-cancel">Cancel</button>
    </div>
  `;
  document.body.appendChild(wrap);
  wrap.querySelector("#de-cancel").onclick = ()=> wrap.remove();
  wrap.querySelector("#de-save").onclick = async ()=>{
    const label = wrap.querySelector("#de-label").value.trim();
    const amount = Number(wrap.querySelector("#de-amount").value);
    const err = wrap.querySelector("#de-error");
    if(!label){ err.style.display="block"; err.textContent="Please describe the expense."; return; }
    if(!amount || amount<=0){ err.style.display="block"; err.textContent="Enter a valid amount."; return; }
    const entry = {
      id: "de_" + Date.now() + "_" + Math.floor(Math.random()*1000),
      date: dateKey,
      label,
      amount,
      addedBy: state.session.username,
      createdAt: new Date().toISOString()
    };
    state.dailyExpenses.push(entry);
    await sset("ms-villa:daily-expenses", state.dailyExpenses);
    wrap.remove();
    renderExpenses();
  };
}

function render(){
  // History integration so the device/browser back button and iOS swipe-back
  // navigate within the app instead of leaving it or doing nothing.
  if(state.view !== lastPushedView){
    try{
      history.pushState({view: state.view, roomId: state.roomId}, "", "#"+state.view);
    }catch(e){}
    lastPushedView = state.view;
  }
  renderView();
  renderChatFab();
}

window.addEventListener("popstate", (e)=>{
  if(e.state && e.state.view){
    state.view = e.state.view;
    if(e.state.roomId) state.roomId = e.state.roomId;
  } else {
    state.view = state.session ? "home" : "login";
  }
  lastPushedView = state.view;
  renderView();
  renderChatFab();
});

function renderView(){
  if(state.view==="login") return renderLogin();
  if(state.view==="phoneLogin") return renderPhoneLogin();
  if(state.view==="home") return renderHome();
  if(state.view==="room") return renderRoom();
  if(state.view==="instructions") return renderInstructions();
  if(state.view==="settings") return renderSettings();
  if(state.view==="changepass") return renderChangePass();
  if(state.view==="duty") return renderDuty();
  if(state.view==="expenses") return renderExpenses();
  if(state.view==="rent") return renderRent();
  if(state.view==="complaints") return renderComplaints();
  if(state.view==="meetings") return renderMeetings();
}

// Floating "Chat with us" button - shown on every screen once signed in.
// It hands off to WhatsApp using the support number set by an admin in Settings.
function renderChatFab(){
  let fab = document.getElementById("chat-fab");
  if(!state.session){ if(fab) fab.remove(); return; }
  if(!fab){
    fab = document.createElement("button");
    fab.id = "chat-fab";
    fab.className = "chat-fab";
    fab.title = "Chat with us";
    fab.innerHTML = ICONS.chat;
    document.body.appendChild(fab);
  }
  fab.onclick = ()=>{
    const num = (state.supportPhone||"").replace(/[^0-9]/g,"");
    if(num){
      window.open(`https://wa.me/${num}?text=${encodeURIComponent("Hi, I need help with Ms Villa.")}`, "_blank");
    } else {
      alert("No support WhatsApp number has been set yet. An admin can add one from Settings.");
    }
  };
}


function topbar(title, backView){
  const me = state.members.find(m=>m.username===state.session.username);
  return `
    <div class="topbar">
      <div class="back" data-nav="${backView}" style="cursor:pointer;">${backView? "&larr; Back" : ""}</div>
      <div class="who">Signed in as<br><b>${me.name}</b></div>
    </div>
  `;
}

function renderHome(){
  const duty = vesselDutyFor(todayKey());
  const dutyName = duty ? nameFor(duty, state.members) : "Unassigned";
  const tiles = state.rooms.map(r=>`
    <div class="room-tile" data-room="${r.id}" style="cursor:pointer;">
      ${ICONS[r.id]||""}
      <div class="name">${r.name}</div>
      <div class="count">${r.assigned.length} assigned</div>
    </div>
  `).join("");
  const quickLinks = [
    {id:"duty", name:"Duty Schedule"},
    {id:"expenses", name:"Room Expenses"},
    {id:"rent", name:"Rent & Pay"},
    {id:"complaints", name:"Complaints"},
    {id:"meetings", name:"Meetings"}
  ];
  const quickTiles = quickLinks.map(q=>`
    <div class="quick-tile" data-nav2="${q.id}">${ICONS[q.id]}<div class="name">${q.name}</div></div>
  `).join("");

  const myRow = ledgerRowFor(state.session.username);
  let duesBlock;
  if(myRow){
    const balance = myRow.due - myRow.paid;
    const isDue = balance > 0;
    const isCredit = balance < 0;
    const pillClass = isDue ? "status-open" : "status-closed";
    const pillText = isDue ? "Due" : (isCredit ? "Credit" : "Completed");
    const amountText = isDue ? inr(balance) : (isCredit ? inr(Math.abs(balance)) : inr(0));
    duesBlock = `
      <div class="card dues-card">
        <div class="dues-top">
          <div class="dues-label">${state.ledger.month} Rent — ${myRow.name}</div>
          <span class="status-pill ${pillClass}">${pillText}</span>
        </div>
        <div class="dues-amount">${amountText}</div>
        <div class="dues-note">${myRow.status}</div>
        <button class="btn-primary" data-nav2="rent" style="margin-top:12px;">Pay Now</button>
      </div>
    `;
  } else {
    duesBlock = `
      <div class="card dues-card">
        <div class="dues-label">${state.ledger.month} Rent</div>
        <div class="dues-note" style="margin-top:6px;">No ledger entry found under your name yet — check with the admin.</div>
      </div>
    `;
  }

  app.innerHTML = `
    ${topbar("Ms Villa", null)}
    ${heroWrap("kitchen", `
      <div class="house-title">
        <h1>Ms Villa</h1>
        <div class="sub">Household Duties &amp; Attendance</div>
      </div>
    `)}
    <div class="duty-strip">
      <div class="lbl">Today's Vessel Cleaning Duty</div>
      <div class="name">${dutyName}</div>
      <div class="sub2">Cooking: ${cookingStaffFor(todayKey()).join(" & ")} · Water can: ${nameFor(state.waterDuty, state.members)}</div>
    </div>
    <div class="section-title">Payment Dues</div>
    ${duesBlock}
    <div class="section-title">Rooms</div>
    <div class="grid">${tiles}</div>
    <div class="section-title">Quick Links</div>
    <div class="grid">${quickTiles}</div>
    <div class="nav-row" style="margin-top:8px;">
      <button class="btn-line" data-nav2="instructions">House Rules</button>
      <button class="btn-line" data-nav2="settings">Settings</button>
    </div>
  `;
  app.querySelectorAll("[data-room]").forEach(el=>{
    el.onclick = ()=>{ state.roomId = el.getAttribute("data-room"); state.view="room"; render(); };
  });
  const nav2 = app.querySelectorAll("[data-nav2]");
  nav2.forEach(el=> el.onclick = ()=>{ state.view = el.getAttribute("data-nav2"); render(); });
}


async function renderRoom(){
  const room = state.rooms.find(r=>r.id===state.roomId);
  const date = todayKey();
  state.attendance[state.roomId] = await loadAttendance(state.roomId, date);
  const att = state.attendance[state.roomId];

  const rows = room.assigned.map(username=>{
    const m = state.members.find(x=>x.username===username) || {name:username};
    const rec = att[username];
    const present = rec && rec.present;
    const photo = rec && rec.photo;
    return `
      <div class="member-row">
        <div class="left">
          ${photo ? `<img class="avatar" src="${photo}">` : `<div class="avatar-empty">${(m.name||"?")[0]}</div>`}
          <div>
            <div class="name">${m.name}</div>
            <span class="status-pill ${present?'status-present':'status-pending'}">${present? 'Present · marked' : 'Not marked yet'}</span>
          </div>
        </div>
        <div>
          <input type="file" accept="image/*" capture="environment" id="file-${username}">
          <button class="cam-btn" data-mark="${username}">${present? 'Update' : 'Mark'}</button>
        </div>
      </div>
    `;
  }).join("") || `<div class="foot-note" style="padding:20px 0;">No one assigned to this room yet. Add members from the button below.</div>`;

  app.innerHTML = `
    ${topbar(room.name,"home")}
    ${heroWrap(imageForRoom(room.id), `
      <div class="house-title" style="padding-top:0;">
        <h1 style="font-size:26px;">${room.name}</h1>
        <div class="sub">${date}</div>
      </div>
    `)}
    <div class="info-block"><div class="lbl">About this room</div>${ROOM_NOTES[room.id]||""}</div>
    <div class="section-title">Assigned Members</div>
    <div class="card" style="padding:6px 18px;">
      ${rows}
    </div>
    <div class="nav-row">
      <button class="btn-line" id="edit-assign">Edit Assignment</button>
    </div>
  `;

  room.assigned.forEach(username=>{
    const btn = app.querySelector(`[data-mark="${username}"]`);
    const file = app.querySelector(`#file-${username}`);
    btn.onclick = ()=> file.click();
    file.onchange = async ()=>{
      const f = file.files[0];
      if(!f) return;
      const reader = new FileReader();
      reader.onload = async ()=>{
        att[username] = { present:true, photo: reader.result, time: new Date().toISOString() };
        await saveAttendance(state.roomId, date, att);
        renderRoom();
      };
      reader.readAsDataURL(f);
    };
  });

  $("#edit-assign").onclick = ()=> openAssignModal(room);
}

function openAssignModal(room){
  const chips = state.members.map(m=>{
    const on = room.assigned.includes(m.username);
    return `<div class="chip ${on?'on':''}" data-chip="${m.username}">${m.name}</div>`;
  }).join("");
  const wrap = document.createElement("div");
  wrap.className = "modal-bg";
  wrap.innerHTML = `
    <div class="modal">
      <h3>Assign — ${room.name}</h3>
      <div class="chip-select">${chips}</div>
      <button class="btn-primary" id="save-assign">Save</button>
      <button class="btn-ghost" id="cancel-assign">Cancel</button>
    </div>
  `;
  document.body.appendChild(wrap);
  let selected = new Set(room.assigned);
  wrap.querySelectorAll("[data-chip]").forEach(chip=>{
    chip.onclick = ()=>{
      const u = chip.getAttribute("data-chip");
      if(selected.has(u)){ selected.delete(u); chip.classList.remove("on"); }
      else { selected.add(u); chip.classList.add("on"); }
    };
  });
  wrap.querySelector("#cancel-assign").onclick = ()=> wrap.remove();
  wrap.querySelector("#save-assign").onclick = async ()=>{
    room.assigned = Array.from(selected);
    await sset("ms-villa:rooms", state.rooms);
    wrap.remove();
    renderRoom();
  };
}


function renderInstructions(){
  const items = INSTRUCTIONS.map(t=>`<li>${t}</li>`).join("");
  app.innerHTML = `
    ${topbar("House Rules","home")}
    ${heroWrap("kitchen", `
      <div class="house-title" style="padding-top:0;">
        <h1 style="font-size:26px;">House Rules</h1>
        <div class="sub">General Cleaning &amp; Maintenance</div>
      </div>
    `)}
    <div class="instr-list"><ol>${items}</ol></div>
    <div class="instr-note">Cleanliness is everyone's responsibility. Please complete your assigned duty on time and maintain the common areas as if they were your own.</div>
  `;
}

function renderDuty(){
  const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const todayDow = new Date().getDay();
  const today = todayKey();
  const hasVesselOverride = !!state.vesselOverrides[today];
  const hasCookingOverride = !!(state.cookingOverrides[today] && state.cookingOverrides[today].length);
  const rows = dayNames.map((dn, i)=>{
    const isToday = i===todayDow;
    const uname = isToday ? vesselDutyFor(today) : state.weeklyVesselDuty[i];
    const who = uname ? nameFor(uname, state.members) : "—";
    return `<div class="weekday-row ${isToday?'today':''}"><div class="day">${dn}</div><div class="who">${who}${isToday && hasVesselOverride ? ' (override)' : ''}</div></div>`;
  }).join("");
  const overrideNote = (hasVesselOverride || hasCookingOverride)
    ? `<div class="instr-note">An admin has set a today-only override for ${[hasVesselOverride?'vessel duty':null, hasCookingOverride?'cooking staff':null].filter(Boolean).join(" and ")}. The weekly schedule below is unaffected.</div>`
    : "";
  app.innerHTML = `
    ${topbar("Duty Schedule","home")}
    ${heroWrap("bedroomA", `
      <div class="house-title" style="padding-top:0;">
        <h1 style="font-size:26px;">Weekly Vessel Duty</h1>
        <div class="sub">Clean vessels on your day, before 12 PM</div>
      </div>
    `)}
    <div class="card" style="padding:6px 18px;">${rows}</div>
    ${overrideNote}
    <div class="section-title">Also Assigned (Default)</div>
    <div class="card">
      <div class="member-row"><div class="name">Cooking (today)</div><div class="tag">${cookingStaffFor(today).join(" & ")}</div></div>
      <div class="member-row"><div class="name">Water Can Refill</div><div class="tag">${nameFor(state.waterDuty, state.members)}</div></div>
    </div>
    <div class="instr-note">Every individual must clean the vessels on their assigned day itself, before 12 PM — or the next person's duty is affected.</div>
    ${(state.members.find(m=>m.username===state.session.username)||{}).admin ? `<div class="nav-row"><button class="btn-line" id="edit-duty" style="flex:1;">Edit Duty Assignments</button></div>` : ""}
  `;
  const editBtn = $("#edit-duty");
  if(editBtn) editBtn.onclick = ()=> openEditDutyModal();
}

function renderExpenses(){
  ensureExpensesCalendarStyles();
  const me = state.members.find(m=>m.username===state.session.username);
  const ledger = state.ledger;
  const rows = ledger.rows.map(r=>`
    <tr>
      <td>${r.name}</td>
      <td class="num">${inr(r.due)}</td>
      <td class="num">${inr(r.paid)}</td>
      <td style="font-size:11px; color:var(--muted);">${r.status}</td>
    </tr>
  `).join("");
  const bills = ledger.bills.map(b=>`
    <div class="member-row"><div class="name">${b.label}</div><div class="tag">${inr(b.amount)}</div></div>
  `).join("");
  const totalDue = ledger.rows.reduce((s,r)=> s + Math.max(0, r.due - r.paid), 0);
  app.innerHTML = `
    ${topbar("Room Expenses","home")}
    ${heroWrap("kitchen", `
      <div class="house-title" style="padding-top:0;">
        <h1 style="font-size:26px;">Room Expenses</h1>
        <div class="sub">${ledger.month} Ledger</div>
      </div>
    `)}
    <div class="section-title">Daily Expenses</div>
    ${buildExpensesCalendar()}
    ${buildExpensesAgenda()}
    <div class="section-title">Payment Dues</div>
    <div class="card dues-card">
      <div class="dues-top">
        <div class="dues-label">Total Outstanding</div>
      </div>
      <div class="dues-amount">${inr(totalDue)}</div>
      <div class="dues-note">Across ${ledger.rows.filter(r=> r.due - r.paid > 0).length} member(s) with a pending balance this month.</div>
    </div>
    <div class="card" style="padding:14px 12px; overflow-x:auto;">
      <table class="ledger-table">
        <tr><th>Member</th><th>Due</th><th>Paid</th><th>Status</th></tr>
        ${rows}
      </table>
    </div>
    <div class="section-title">Shared Bills</div>
    <div class="card">
      ${bills}
      <div class="ledger-total"><span>Total Bills${ledger.totalBillsAuto ? ' <span style="font-weight:400; color:var(--muted); font-size:11px;">(auto)</span>' : ''}</span><b>${inr(effectiveTotalBills(ledger))}</b></div>
      <div class="ledger-total"><span>Remaining Balance${ledger.remainingAuto ? ' <span style="font-weight:400; color:var(--muted); font-size:11px;">(auto)</span>' : ''}</span><b>${inr(effectiveRemaining(ledger))}</b></div>
    </div>
    <div class="instr-note">${ledger.remainingNote}. Figures are transcribed from the handwritten monthly ledger — confirm with the admin if any amount looks unclear.</div>
    ${me.admin ? `<div class="nav-row"><button class="btn-line" id="edit-expenses" style="flex:1;">Edit Room Expenses</button></div>` : ""}
  `;
  const editBtn = $("#edit-expenses");
  if(editBtn) editBtn.onclick = ()=> openEditExpensesModal();

  app.querySelectorAll("[data-cal-date]").forEach(el=>{
    el.onclick = ()=>{
      const key = el.getAttribute("data-cal-date");
      expSelectedDate = key;
      const [y,m] = key.split("-").map(Number);
      expCalYear = y; expCalMonth = m-1;
      renderExpenses();
    };
  });
  app.querySelectorAll("[data-cal-nav]").forEach(el=>{
    el.onclick = ()=>{
      const dir = Number(el.getAttribute("data-cal-nav"));
      expCalMonth += dir;
      if(expCalMonth < 0){ expCalMonth = 11; expCalYear -= 1; }
      if(expCalMonth > 11){ expCalMonth = 0; expCalYear += 1; }
      renderExpenses();
    };
  });
  const addExpenseBtn = $("#add-daily-expense");
  if(addExpenseBtn) addExpenseBtn.onclick = ()=> openAddExpenseModal(expSelectedDate);
  app.querySelectorAll("[data-del-expense]").forEach(el=>{
    el.onclick = async ()=>{
      const id = el.getAttribute("data-del-expense");
      if(!confirm("Remove this expense entry?")) return;
      state.dailyExpenses = state.dailyExpenses.filter(e=>e.id!==id);
      await sset("ms-villa:daily-expenses", state.dailyExpenses);
      renderExpenses();
    };
  });
}


function renderRent(){
  const upiLink = `upi://pay?pa=${encodeURIComponent(RENT_INFO.upiId)}&pn=${encodeURIComponent(RENT_INFO.payeeName)}&cu=INR`;
  app.innerHTML = `
    ${topbar("Rent & Pay","home")}
    ${heroWrap("living", `
      <div class="house-title" style="padding-top:0;">
        <h1 style="font-size:26px;">Room Rent</h1>
        <div class="sub">Pay via UPI</div>
      </div>
    `)}
    <div class="upi-box">
      <div>UPI ID</div>
      <div class="id">${RENT_INFO.upiId}</div>
    </div>
    <div class="pay-btn-row">
      <a class="pay-app-btn" href="${upiLink}"><b>PhonePe</b>Tap to pay</a>
      <a class="pay-app-btn" href="${upiLink}"><b>Google Pay</b>Tap to pay</a>
      <a class="pay-app-btn" href="${upiLink}"><b>Super Money</b>Tap to pay</a>
    </div>
    <div class="foot-note" style="margin-bottom:8px;">These buttons open your phone's UPI app chooser using the ID above. If nothing opens, copy the UPI ID into the app manually.</div>
    <div class="instr-note">Always keep a payment screenshot until your name is marked completed in the monthly ledger.</div>
  `;
}

function renderComplaints(){
  const me = state.members.find(m=>m.username===state.session.username);
  const mine = state.complaints.slice().reverse();
  const rows = mine.map(c=>`
    <div class="complaint-card">
      <div class="top">
        <div class="cat">${c.category}</div>
        <span class="status-pill ${c.status==='closed'?'status-closed':'status-open'}">${c.status==='closed'?'Resolved':'Open'}</span>
      </div>
      <div class="desc">${c.description}</div>
      <div class="meta">${nameFor(c.username, state.members)} · ${new Date(c.createdAt).toLocaleDateString()} ${c.status!=='closed' && me.admin ? `<span data-close="${c.id}" style="color:var(--accent); cursor:pointer; margin-left:8px;">Mark resolved</span>` : ""}</div>
    </div>
  `).join("") || `<div class="foot-note" style="padding:20px 0;">No complaints raised yet.</div>`;

  app.innerHTML = `
    ${topbar("Complaints","home")}
    ${heroWrap("bedroomB", `
      <div class="house-title" style="padding-top:0;">
        <h1 style="font-size:26px;">Raise a Complaint</h1>
        <div class="sub">Maintenance &amp; Issues</div>
      </div>
    `)}
    <div class="nav-row"><button class="btn-primary" id="new-complaint">+ New Complaint</button></div>
    <div class="section-title">All Complaints</div>
    ${rows}
  `;
  $("#new-complaint").onclick = ()=> openComplaintModal();
  app.querySelectorAll("[data-close]").forEach(el=>{
    el.onclick = async ()=>{
      const id = el.getAttribute("data-close");
      const c = state.complaints.find(x=>x.id===id);
      if(c){ c.status="closed"; await sset("ms-villa:complaints", state.complaints); renderComplaints(); }
    };
  });
}

function openComplaintModal(){
  const cats = COMPLAINT_CATEGORIES.map(c=>`<option value="${c}">${c}</option>`).join("");
  const wrap = document.createElement("div");
  wrap.className = "modal-bg";
  wrap.innerHTML = `
    <div class="modal">
      <h3>New Complaint</h3>
      <label>Category</label>
      <select id="c-cat">${cats}</select>
      <label>Describe the issue</label>
      <textarea id="c-desc" placeholder="e.g. Washing machine drum not spinning, making loud noise"></textarea>
      <div class="error" id="c-err" style="display:none;"></div>
      <button class="btn-primary" id="c-save">Submit Complaint</button>
      <button class="btn-ghost" id="c-cancel">Cancel</button>
    </div>
  `;
  document.body.appendChild(wrap);
  wrap.querySelector("#c-cancel").onclick = ()=> wrap.remove();
  wrap.querySelector("#c-save").onclick = async ()=>{
    const desc = wrap.querySelector("#c-desc").value.trim();
    const err = wrap.querySelector("#c-err");
    if(!desc){ err.style.display="block"; err.textContent="Please describe the issue."; return; }
    const complaint = {
      id: "c" + Date.now(),
      username: state.session.username,
      category: wrap.querySelector("#c-cat").value,
      description: desc,
      status: "open",
      createdAt: new Date().toISOString()
    };
    state.complaints.push(complaint);
    await sset("ms-villa:complaints", state.complaints);
    wrap.remove();
    renderComplaints();
    notifyMembers("New complaint raised", `${complaint.category}: ${complaint.description.slice(0,80)}`);
  };
}

function renderMeetings(){
  const me = state.members.find(m=>m.username===state.session.username);
  const now = Date.now();
  const sorted = [...state.meetings].sort((a,b)=> new Date(a.time) - new Date(b.time));
  const upcoming = sorted.filter(m=> !m.time || new Date(m.time).getTime() >= now - 60*60*1000);
  const past = sorted.filter(m=> m.time && new Date(m.time).getTime() < now - 60*60*1000);

  function card(m){
    const when = m.time ? new Date(m.time).toLocaleString([], {dateStyle:"medium", timeStyle:"short"}) : "No time set";
    return `
      <div class="meeting-card">
        <div class="top">
          <div>
            <div class="title">${m.title}</div>
            <div class="meta">${when}</div>
          </div>
          <span class="meeting-platform-pill">${m.platform}</span>
        </div>
        ${m.notes ? `<div class="meta" style="margin-top:6px;">${m.notes}</div>` : ""}
        <a class="join-btn" href="${m.link}" target="_blank" rel="noopener">Join ${m.platform}</a>
        ${me.admin ? `<span data-del-meeting="${m.id}" style="color:var(--danger); font-size:11px; margin-left:12px; cursor:pointer;">Remove</span>` : ""}
      </div>
    `;
  }

  app.innerHTML = `
    ${topbar("Meetings","home")}
    ${heroWrap("living", `
      <div class="house-title" style="padding-top:0;">
        <h1 style="font-size:26px;">Meetings</h1>
        <div class="sub">Zoom &amp; Google Meet links</div>
      </div>
    `)}
    ${me.admin ? `<div class="fab-add"><button class="btn-primary" id="add-meeting">+ Schedule a Meeting</button></div>` : ""}
    <div class="section-title">Upcoming</div>
    ${upcoming.length ? upcoming.map(card).join("") : `<div class="foot-note" style="padding:0 18px 18px;">No meetings scheduled yet.</div>`}
    ${past.length ? `<div class="section-title">Past</div>${past.map(card).join("")}` : ""}
  `;

  if(me.admin){
    $("#add-meeting").onclick = ()=> openMeetingModal();
    app.querySelectorAll("[data-del-meeting]").forEach(el=>{
      el.onclick = async ()=>{
        const id = el.getAttribute("data-del-meeting");
        state.meetings = state.meetings.filter(m=>m.id!==id);
        await sset("ms-villa:meetings", state.meetings);
        renderMeetings();
      };
    });
  }
}

function openMeetingModal(){
  const wrap = document.createElement("div");
  wrap.className = "modal-bg";
  wrap.innerHTML = `
    <div class="modal">
      <h3>Schedule a Meeting</h3>
      <label>Title</label>
      <input type="text" id="m-title" placeholder="e.g. Monthly house meeting">
      <label>Platform</label>
      <select id="m-platform">
        <option>Zoom</option>
        <option>Google Meet</option>
        <option>Microsoft Teams</option>
        <option>Other</option>
      </select>
      <label>Meeting link</label>
      <input type="text" id="m-link" placeholder="https://zoom.us/j/...">
      <label>Date &amp; time</label>
      <input type="text" id="m-time" placeholder="YYYY-MM-DDTHH:MM" onfocus="(this.type='datetime-local')">
      <label>Notes (optional)</label>
      <textarea id="m-notes" placeholder="Agenda, dial-in details, etc."></textarea>
      <div class="error" id="m-error" style="display:none;"></div>
      <button class="btn-primary" id="m-save">Save Meeting</button>
      <button class="btn-ghost" id="m-cancel">Cancel</button>
    </div>
  `;
  document.body.appendChild(wrap);
  $("#m-cancel").onclick = ()=> wrap.remove();
  $("#m-save").onclick = async ()=>{
    const title = $("#m-title").value.trim();
    const link = $("#m-link").value.trim();
    const err = $("#m-error");
    if(!title || !link){ err.style.display="block"; err.textContent="Title and link are required."; return; }
    const time = $("#m-time").value || null;
    state.meetings.push({
      id: "m_" + Date.now(),
      title,
      platform: $("#m-platform").value,
      link,
      time,
      notes: $("#m-notes").value.trim(),
      createdBy: state.session.username
    });
    await sset("ms-villa:meetings", state.meetings);
    wrap.remove();
    renderMeetings();
    notifyMembers(`Meeting scheduled: ${title}`, time ? `Starts ${time}` : "Check the Meetings tab for details.");
  };
}

function renderSettings(){
  const me = state.members.find(m=>m.username===state.session.username);
  const memberRows = state.members.map(m=>`
    <div class="member-row">
      <div class="left"><div class="avatar-empty">${m.name[0]}</div><div>
        <div class="name">${m.name}</div><div class="tag">${m.username}${m.admin? ' · admin':''}${m.phone? ' · '+m.phone : ''}</div>
      </div></div>
      ${me.admin ? `<span data-edit-phone="${m.username}" style="color:var(--accent); font-size:11px; cursor:pointer;">${m.phone? 'Edit phone' : 'Add phone'}</span>` : ""}
    </div>
  `).join("");
  app.innerHTML = `
    ${topbar("Settings","home")}
    ${heroWrap("living", `
      <div class="house-title" style="padding-top:0;">
        <h1 style="font-size:26px;">Settings</h1>
        <div class="sub">${me.name}</div>
      </div>
    `)}
    <div class="nav-row">
      <button class="btn-primary" id="go-changepass">Change Password</button>
    </div>
    <div class="section-title">Notifications</div>
    <div class="card">
      <div class="foot-note" style="margin:0 0 12px; text-align:left;" id="notif-status">${notificationStatusLabel()}</div>
      <button class="btn-line" id="toggle-notif" style="width:100%;">${notificationsEnabled() ? "Turn Off Notifications" : "Enable Notifications"}</button>
    </div>
    ${me.admin ? `
      <div class="section-title">All Members (${state.members.length}/15)</div>
      <div class="card" style="padding:6px 18px;">${memberRows}</div>
      <div class="nav-row"><button class="btn-line" id="add-member" style="flex:1;">Add Member</button></div>
      <div class="section-title">Support / Chat with us</div>
      <div class="card">
        <label>WhatsApp number for "Chat with us" (with country code)</label>
        <input type="text" id="support-phone" placeholder="+91 98765 43210" value="${state.supportPhone||''}">
        <button class="btn-primary" id="save-support">Save Number</button>
      </div>
    ` : ""}
    <div class="nav-row"><button class="btn-ghost" id="logout">Sign Out</button></div>
  `;
  $("#go-changepass").onclick = ()=>{ state.view="changepass"; render(); };
  $("#logout").onclick = ()=>{ state.session=null; state.view="login"; render(); };
  $("#toggle-notif").onclick = async ()=>{
    if(notificationsEnabled()){ await unsubscribeFromPush(); } else { await subscribeToPush(); }
    renderSettings();
  };
  if(me.admin){
    $("#add-member").onclick = ()=> openAddMemberModal();
    $("#save-support").onclick = async ()=>{
      state.supportPhone = $("#support-phone").value.trim();
      await sset("ms-villa:support-phone", state.supportPhone);
      renderChatFab();
      renderSettings();
    };
    app.querySelectorAll("[data-edit-phone]").forEach(el=>{
      el.onclick = async ()=>{
        const username = el.getAttribute("data-edit-phone");
        const m = state.members.find(x=>x.username===username);
        const phone = prompt(`Mobile number for ${m.name} (used for OTP sign-in):`, m.phone||"");
        if(phone===null) return;
        m.phone = phone.trim();
        await sset("ms-villa:members", state.members);
        renderSettings();
      };
    });
  }
}


document.addEventListener("click", (e)=>{
  const t = e.target.closest("[data-nav]");
  if(t && t.getAttribute("data-nav")){
    const target = t.getAttribute("data-nav");
    if(target==="home"){ state.view="home"; render(); }
    if(target==="settings"){ state.view="settings"; render(); }
    if(target==="login"){ state.view="login"; render(); }
    if(target==="phoneLogin"){ state.view="phoneLogin"; render(); }
  }
});

// Keeps everyone's data fresh without needing a manual refresh.
// The shared data function has no websocket/push support of its own for
// in-app state, so this polls it periodically and also re-syncs the moment
// the app regains focus
// (e.g. switching back from another app), which covers the common
// "admin changed something and I don't see it" case quickly.
let syncing = false;
async function syncNow(){
  if(syncing || !state.session) return;
  syncing = true;
  try{
    const before = JSON.stringify({
      members: state.members, meetings: state.meetings, ledger: state.ledger,
      dailyExpenses: state.dailyExpenses,
      cookingStaff: state.cookingStaff, waterDuty: state.waterDuty,
      weeklyVesselDuty: state.weeklyVesselDuty, supportPhone: state.supportPhone,
      vesselOverrides: state.vesselOverrides, cookingOverrides: state.cookingOverrides,
      complaints: state.complaints
    });
    await loadCore();
    const after = JSON.stringify({
      members: state.members, meetings: state.meetings, ledger: state.ledger,
      dailyExpenses: state.dailyExpenses,
      cookingStaff: state.cookingStaff, waterDuty: state.waterDuty,
      weeklyVesselDuty: state.weeklyVesselDuty, supportPhone: state.supportPhone,
      vesselOverrides: state.vesselOverrides, cookingOverrides: state.cookingOverrides,
      complaints: state.complaints
    });
    if(before !== after && state.view !== "room"){ renderView(); renderChatFab(); }
  }catch(e){ /* offline or storage hiccup - ignore and try again next tick */ }
  syncing = false;
}
setInterval(syncNow, 6000);
document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) syncNow(); });
window.addEventListener("focus", syncNow);
window.addEventListener("online", syncNow);

async function init(){
  try{
    await loadCore();
    // database.js may have been loaded before <div id="app"> existed.
    // Re-resolve it now that the DOM is ready.
    if(typeof getApp === "function") app = getApp();
    if(!app) throw new Error('Missing #app element in index.html');
    render();
    if(typeof initNotifications === "function") initNotifications();
  }catch(err){
    console.error('[Ms Villa] startup failed:', err);
    const root = (typeof getApp === 'function' ? getApp() : document.querySelector('#app'));
    if(root){
      root.innerHTML = `
        <div style="font-family:system-ui,sans-serif;padding:28px;max-width:680px;margin:40px auto;color:#111;background:#fff;">
          <h2 style="margin-top:0;">Ms Villa could not start</h2>
          <p>The page loaded, but one of the app scripts failed.</p>
          <pre style="white-space:pre-wrap;background:#f4f4f4;padding:14px;border-radius:8px;overflow:auto;">${String(err && err.stack || err)}</pre>
          <p style="font-size:13px;color:#666;">Check that database.js, auth.js, admin.js, notifications.js and app.js are all deployed and loaded in that order.</p>
        </div>`;
    }
  }
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
else init();



