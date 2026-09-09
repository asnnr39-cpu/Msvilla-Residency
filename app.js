
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
  if(state.view==="dailyExpenses") return renderDailyExpenses();
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
    {id:"dailyExpenses", name:"Daily Expenses"},
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
}
 
// Day-wise spending log, separate from the monthly Room Expenses ledger
// above. Anyone in the house (not just the admin) can add or edit an
// entry here — it's meant as a shared running log of day-to-day
// household spending (groceries, gas, quick repairs, etc.), grouped by
// the date each entry was logged under.
// Day-wise spending log with clickable monthly calendar
 
function ensureDailyExpensesCalendarStyles(){
  if(document.getElementById("daily-expenses-calendar-styles")) return;
 
  const style = document.createElement("style");
  style.id = "daily-expenses-calendar-styles";
  style.textContent = `
    .daily-calendar-card{padding:12px;}
    .daily-cal-header{
      display:flex;
      align-items:center;
      justify-content:space-between;
      margin-bottom:12px;
    }
    .daily-cal-month{
      text-align:center;
      font-size:21px;
      font-weight:700;
      letter-spacing:1px;
    }
    .daily-cal-month span{
      display:block;
      font-size:11px;
      color:var(--muted);
      font-weight:500;
      letter-spacing:0;
      margin-top:2px;
    }
    .daily-cal-nav{
      width:40px;
      height:40px;
      border:0;
      border-radius:50%;
      background:var(--soft);
      color:var(--ink);
      font-size:28px;
      line-height:1;
      cursor:pointer;
    }
    .daily-cal-weekdays,
    .daily-cal-grid{
      display:grid;
      grid-template-columns:repeat(7,1fr);
      gap:5px;
    }
    .daily-cal-weekdays{margin-bottom:5px;}
    .daily-cal-weekdays div{
      text-align:center;
      font-size:10px;
      font-weight:700;
      color:var(--muted);
      padding:5px 0;
    }
    .daily-cal-day{
      min-height:58px;
      padding:5px 3px;
      border:1px solid transparent;
      border-radius:9px;
      background:var(--soft);
      color:var(--ink);
      cursor:pointer;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:flex-start;
      font-family:inherit;
    }
    .daily-cal-day:hover{border-color:var(--accent);}
    .daily-cal-day.selected{
      border:2px solid var(--accent);
      background:var(--accent-soft,var(--soft));
    }
    .daily-cal-number{
      font-size:15px;
      font-weight:700;
      line-height:20px;
    }
    .daily-cal-day.has-expense .daily-cal-number{font-weight:800;}
    .daily-cal-amount{
      display:block;
      margin-top:4px;
      font-size:9px;
      font-weight:700;
      color:var(--accent);
      white-space:nowrap;
      max-width:100%;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    .daily-cal-empty{min-height:58px;}
  `;
  document.head.appendChild(style);
}
 
let dailyExpenseCalendarMonth = new Date();
let selectedDailyExpenseDate = todayKey();
 
function renderDailyExpenses(){
  ensureDailyExpensesCalendarStyles();
  const list = (state.dailyExpenses || []).slice();
 
  const calYear = dailyExpenseCalendarMonth.getFullYear();
  const calMonth = dailyExpenseCalendarMonth.getMonth();
 
  const monthKey =
    calYear + "-" + String(calMonth + 1).padStart(2, "0");
 
  if (!selectedDailyExpenseDate.startsWith(monthKey)) {
    selectedDailyExpenseDate = monthKey + "-01";
  }
 
  const selectedExpenses = list
    .filter(e => e.date === selectedDailyExpenseDate)
    .sort((a,b) => (b.id || "").localeCompare(a.id || ""));
 
  const selectedTotal = sumDailyExpenses(selectedExpenses);
  const monthTotal = sumDailyExpenses(
    dailyExpensesForMonth(list, monthKey)
  );
  const grandTotal = sumDailyExpenses(list);
 
  const byDate = {};
  list.forEach(e => {
    if (!e.date) return;
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  });
 
  const firstDay = new Date(calYear, calMonth, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
 
  const monthNames = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEPT", "OCT", "NOV", "DEC"
  ];
 
  let calendarCells = "";
 
  for(let i = 0; i < startOffset; i++){
    calendarCells += `<div class="daily-cal-empty"></div>`;
  }
 
  for(let day = 1; day <= daysInMonth; day++){
    const dateKey =
      monthKey + "-" + String(day).padStart(2, "0");
 
    const dayExpenses = byDate[dateKey] || [];
    const dayTotal = sumDailyExpenses(dayExpenses);
 
