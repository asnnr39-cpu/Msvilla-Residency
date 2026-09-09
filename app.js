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
function renderDailyExpenses(){
  /* =========================================================
   DAILY EXPENSES CALENDAR
   ========================================================= */

let dailyExpenseCalendarMonth = new Date();
let selectedDailyExpenseDate = todayKey();

function ensureDailyExpensesCalendarStyles(){
  if(document.getElementById("daily-expenses-calendar-styles")) return;

  const style = document.createElement("style");
  style.id = "daily-expenses-calendar-styles";

  style.textContent = `
    .daily-calendar-card {
      padding: 12px;
    }

    .daily-cal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .daily-cal-month {
      text-align: center;
      font-size: 21px;
      font-weight: 700;
      letter-spacing: 1px;
    }

    .daily-cal-month span {
      display: block;
      font-size: 11px;
      color: var(--muted);
      font-weight: 500;
      letter-spacing: 0;
      margin-top: 2px;
    }

    .daily-cal-nav {
      width: 40px;
      height: 40px;
      border: 0;
      border-radius: 50%;
      background: var(--soft);
      color: var(--ink);
      font-size: 28px;
      line-height: 1;
      cursor: pointer;
    }

    .daily-cal-weekdays,
    .daily-cal-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 5px;
    }

    .daily-cal-weekdays {
      margin-bottom: 5px;
    }

    .daily-cal-weekdays div {
      text-align: center;
      font-size: 10px;
      font-weight: 700;
      color: var(--muted);
      padding: 5px 0;
    }

    .daily-cal-day {
      min-height: 58px;
      padding: 5px 3px;
      border: 1px solid transparent;
      border-radius: 9px;
      background: var(--soft);
      color: var(--ink);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      font-family: inherit;
    }

    .daily-cal-day:hover {
      border-color: var(--accent);
    }

    .daily-cal-day.selected {
      border: 2px solid var(--accent);
      background: var(--accent-soft, var(--soft));
    }

    .daily-cal-number {
      font-size: 15px;
      font-weight: 700;
      line-height: 20px;
    }

    .daily-cal-day.has-expense .daily-cal-number {
      font-weight: 800;
    }

    .daily-cal-amount {
      display: block;
      margin-top: 4px;
      font-size: 9px;
      font-weight: 700;
      color: var(--accent);
      white-space: nowrap;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .daily-cal-empty {
      min-height: 58px;
    }
  `;

  document.head.appendChild(style);
}


function renderDailyExpenses(){

  ensureDailyExpensesCalendarStyles();

  const list = (state.dailyExpenses || []).slice();

  /* -------------------------------------------------------
     CURRENT CALENDAR MONTH
     ------------------------------------------------------- */

  const calYear =
    dailyExpenseCalendarMonth.getFullYear();

  const calMonth =
    dailyExpenseCalendarMonth.getMonth();

  const monthKey =
    calYear +
    "-" +
    String(calMonth + 1).padStart(2, "0");


  /* -------------------------------------------------------
     SELECTED DATE
     ------------------------------------------------------- */

  if(!selectedDailyExpenseDate.startsWith(monthKey)){
    selectedDailyExpenseDate =
      monthKey + "-01";
  }


  /* -------------------------------------------------------
     SELECTED DAY EXPENSES
     ------------------------------------------------------- */

  const selectedExpenses =
    list
      .filter(e => e.date === selectedDailyExpenseDate)
      .sort((a,b) =>
        (b.id || "").localeCompare(a.id || "")
      );

  const selectedTotal =
    sumDailyExpenses(selectedExpenses);


  /* -------------------------------------------------------
     MONTH TOTAL
     ------------------------------------------------------- */

  const monthExpenses =
    dailyExpensesForMonth(
      list,
      monthKey
    );

  const monthTotal =
    sumDailyExpenses(monthExpenses);


  /* -------------------------------------------------------
     ALL-TIME TOTAL
     ------------------------------------------------------- */

  const grandTotal =
    sumDailyExpenses(list);


  /* -------------------------------------------------------
     GROUP EXPENSES BY DATE
     ------------------------------------------------------- */

  const byDate = {};

  list.forEach(e => {

    if(!e.date) return;

    if(!byDate[e.date]){
      byDate[e.date] = [];
    }

    byDate[e.date].push(e);

  });


  /* -------------------------------------------------------
     CALENDAR INFORMATION
     ------------------------------------------------------- */

  const firstDay =
    new Date(
      calYear,
      calMonth,
      1
    );

  // Monday = 0
  const startOffset =
    (firstDay.getDay() + 6) % 7;

  const daysInMonth =
    new Date(
      calYear,
      calMonth + 1,
      0
    ).getDate();


  const monthNames = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEPT",
    "OCT",
    "NOV",
    "DEC"
  ];


  /* -------------------------------------------------------
     BUILD CALENDAR
     ------------------------------------------------------- */

  let calendarCells = "";


  // Empty cells before first day
  for(
    let i = 0;
    i < startOffset;
    i++
  ){

    calendarCells += `
      <div class="daily-cal-empty"></div>
    `;

  }


  // Calendar dates
  for(
    let day = 1;
    day <= daysInMonth;
    day++
  ){

    const dateKey =
      monthKey +
      "-" +
      String(day).padStart(2, "0");


    const dayExpenses =
      byDate[dateKey] || [];


    const dayTotal =
      sumDailyExpenses(dayExpenses);


    const selected =
      dateKey === selectedDailyExpenseDate;


    const hasExpense =
      dayExpenses.length > 0;


    calendarCells += `

      <button
        type="button"
        class="daily-cal-day
          ${selected ? "selected" : ""}
          ${hasExpense ? "has-expense" : ""}"
        data-daily-date="${dateKey}"
      >

        <span class="daily-cal-number">
          ${day}
        </span>

        ${
          hasExpense
          ?
          `
            <span class="daily-cal-amount">
              ${inr(dayTotal)}
            </span>
          `
          :
          ""
        }

      </button>

    `;

  }


  /* -------------------------------------------------------
     SELECTED DAY DISPLAY
     ------------------------------------------------------- */

  let selectedHtml;


  if(selectedExpenses.length){

    const rows =
      selectedExpenses
        .map(e => `

          <div
            class="member-row"
            style="
              padding:13px 0;
              align-items:center;
            "
          >

            <div class="left">

              <div>

                <div class="name">
                  ${e.note || "Expense"}
                </div>

                ${
                  e.addedBy
                  ?
                  `
                    <div class="tag">
                      Added by
                      ${nameFor(
                        e.addedBy,
                        state.members
                      )}
                    </div>
                  `
                  :
                  ""
                }

              </div>

            </div>


            <div
              style="
                font-size:15px;
                font-weight:700;
                color:var(--ink);
                white-space:nowrap;
              "
            >

              ${inr(
                Number(e.amount) || 0
              )}

            </div>

          </div>

        `)
        .join("");


    selectedHtml = `

      <div
        class="card"
        style="
          padding:14px 16px 4px;
        "
      >

        <div
          class="dues-top"
          style="
            margin-bottom:4px;
          "
        >

          <div>

            <div
              class="dues-label"
              style="
                text-transform:none;
                letter-spacing:0;
                font-size:15px;
                color:var(--ink);
                font-weight:700;
              "
            >

              ${formatDayLabel(
                selectedDailyExpenseDate
              )}

            </div>


            <div
              style="
                font-size:12px;
                color:var(--muted);
                margin-top:3px;
              "
            >

              ${selectedExpenses.length}

              expense${
                selectedExpenses.length === 1
                ? ""
                : "s"
              }

            </div>

          </div>


          <b
            style="
              font-family:
                'Cormorant Garamond',
                serif;
              font-style:italic;
              font-size:19px;
              color:var(--accent);
            "
          >

            ${inr(selectedTotal)}

          </b>

        </div>


        ${rows}

      </div>

    `;

  } else {

    selectedHtml = `

      <div
        class="card"
        style="
          padding:22px 16px;
          text-align:center;
        "
      >

        <div
          style="
            font-size:14px;
            font-weight:600;
            color:var(--ink);
          "
        >

          No expenses on this day

        </div>


        <div
          style="
            font-size:12px;
            color:var(--muted);
            margin-top:5px;
          "
        >

          Tap "+ Add Expense"
          to record spending.

        </div>

      </div>

    `;

  }


  /* -------------------------------------------------------
     PAGE
     ------------------------------------------------------- */

  app.innerHTML = `

    ${topbar(
      "Daily Expenses",
      "home"
    )}


    ${heroWrap(
      "kitchen",
      `

        <div
          class="house-title"
          style="padding-top:0;"
        >

          <h1 style="font-size:26px;">
            Daily Expenses
          </h1>

          <div class="sub">
            Select a date to see
            that day's spending
          </div>

        </div>

      `
    )}


    <div class="section-title">
      Calendar
    </div>


    <div
      class="card daily-calendar-card"
    >

      <div class="daily-cal-header">

        <button
          type="button"
          class="daily-cal-nav"
          id="daily-cal-prev"
          aria-label="Previous month"
        >
          ‹
        </button>


        <div class="daily-cal-month">

          ${monthNames[calMonth]}

          <span>
            ${calYear}
          </span>

        </div>


        <button
          type="button"
          class="daily-cal-nav"
          id="daily-cal-next"
          aria-label="Next month"
        >
          ›
        </button>

      </div>


      <div class="daily-cal-weekdays">

        <div>M</div>
        <div>T</div>
        <div>W</div>
        <div>T</div>
        <div>F</div>
        <div>S</div>
        <div>S</div>

      </div>


      <div class="daily-cal-grid">

        ${calendarCells}

      </div>


      <div
        style="
          margin-top:10px;
          font-size:11px;
          color:var(--muted);
          text-align:center;
        "
      >

        Tap any date to view
        expenses spent that day.

      </div>

    </div>


    <div class="section-title">
      Selected Day
    </div>


    ${selectedHtml}


    <div class="nav-row">

      <button
        class="btn-primary"
        id="add-daily-expense"
        style="flex:1;"
      >

        + Add Expense

      </button>

    </div>


    <div class="section-title">

      ${monthNames[calMonth]}
      Summary

    </div>


    <div class="card dues-card">

      <div class="dues-top">

        <div class="dues-label">

          Spent in
          ${monthNames[calMonth]}

        </div>

      </div>


      <div class="dues-amount">

        ${inr(monthTotal)}

      </div>


      <div class="dues-note">

        All-time total:
        ${inr(grandTotal)}

      </div>

    </div>


    <div
      class="foot-note"
      style="padding:4px 18px 0;"
    >

      Everyone in the house can
      add, edit, or remove entries.

    </div>

  `;


  /* -------------------------------------------------------
     DATE CLICK
     ------------------------------------------------------- */

  app
    .querySelectorAll(
      "[data-daily-date]"
    )
    .forEach(btn => {

      btn.onclick = () => {

        selectedDailyExpenseDate =
          btn.getAttribute(
            "data-daily-date"
          );

        renderDailyExpenses();

      };

    });


  /* -------------------------------------------------------
     PREVIOUS MONTH
     ------------------------------------------------------- */

  $("#daily-cal-prev").onclick = () => {

    dailyExpenseCalendarMonth =
      new Date(
        calYear,
        calMonth - 1,
        1
      );

    renderDailyExpenses();

  };


  /* -------------------------------------------------------
     NEXT MONTH
     ------------------------------------------------------- */

  $("#daily-cal-next").onclick = () => {

    dailyExpenseCalendarMonth =
      new Date(
        calYear,
        calMonth + 1,
        1
      );

    renderDailyExpenses();

  };


  /* -------------------------------------------------------
     ADD EXPENSE
     ------------------------------------------------------- */

  $("#add-daily-expense").onclick =
    () => openEditDailyExpensesModal();

}
function openEditDailyExpensesModal(){
  const draft = JSON.parse(JSON.stringify(state.dailyExpenses||[]));
  const wrap = document.createElement("div");
  wrap.className = "modal-bg";
  document.body.appendChild(wrap);

  function rowHtml(e, i){
    return `
      <div class="member-row" style="align-items:flex-start; flex-wrap:wrap; gap:8px 10px;">
        <input type="text" class="de-date" data-i="${i}" value="${e.date||''}" placeholder="YYYY-MM-DD" style="width:130px; margin-bottom:0;" onfocus="(this.type='date')">
        <input type="text" inputmode="numeric" class="de-amount" data-i="${i}" value="${e.amount||''}" placeholder="Amount" style="width:90px; margin-bottom:0;">
        <input type="text" class="de-note" data-i="${i}" value="${e.note||''}" placeholder="What was it for?" style="flex:1 1 100%; margin-bottom:0;">
        <span data-remove-exp="${i}" style="color:var(--danger); font-size:12px; cursor:pointer;">Remove</span>
      </div>
    `;
  }

  function renderModal(){
    wrap.innerHTML = `
      <div class="modal">
        <h3>Daily Expenses</h3>
        <div class="foot-note" style="text-align:left; padding:0 0 12px; margin:0;">Anyone in the house can add or edit an entry below.</div>
        ${draft.length ? draft.map(rowHtml).join("") : `<div class="foot-note" style="padding:0 0 12px; text-align:left; margin:0;">No entries yet — add your first one below.</div>`}
        <button type="button" class="btn-ghost" id="de-add-row" style="margin-top:2px;">+ Add Expense Row</button>
        <div class="error" id="de-err" style="display:none;"></div>
        <button class="btn-primary" id="de-save" style="margin-top:14px;">Save Changes</button>
        <button class="btn-ghost" id="de-cancel">Cancel</button>
      </div>
    `;

    wrap.querySelector("#de-cancel").onclick = ()=> wrap.remove();
    wrap.querySelector("#de-add-row").onclick = ()=>{
      draft.push({
        id: "de_" + Date.now() + Math.random().toString(36).slice(2,6),
        date: todayKey(),
        amount: 0,
        note: "",
        addedBy: state.session.username
      });
      renderModal();
    };
    wrap.querySelectorAll("[data-remove-exp]").forEach(el=>{
      el.onclick = ()=>{ draft.splice(parseInt(el.getAttribute("data-remove-exp"),10),1); renderModal(); };
    });

    wrap.querySelector("#de-save").onclick = async ()=>{
      const err = wrap.querySelector("#de-err");
      err.style.display = "none";

      wrap.querySelectorAll(".de-date").forEach(el=> draft[parseInt(el.getAttribute("data-i"),10)].date = el.value.trim());
      wrap.querySelectorAll(".de-amount").forEach(el=> draft[parseInt(el.getAttribute("data-i"),10)].amount = Number(el.value)||0);
      wrap.querySelectorAll(".de-note").forEach(el=> draft[parseInt(el.getAttribute("data-i"),10)].note = el.value.trim());

      if(draft.some(e=> !e.date)){ err.style.display="block"; err.textContent="Every entry needs a date."; return; }

      state.dailyExpenses = draft;
      await sset("ms-villa:daily-expenses", state.dailyExpenses);
      wrap.remove();
      renderDailyExpenses();
      notifyMembers("Daily expenses updated", `${nameFor(state.session.username, state.members)} added or edited an entry in the daily expenses log.`);
    };
  }

  renderModal();
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
      cookingStaff: state.cookingStaff, waterDuty: state.waterDuty,
      weeklyVesselDuty: state.weeklyVesselDuty, supportPhone: state.supportPhone,
      vesselOverrides: state.vesselOverrides, cookingOverrides: state.cookingOverrides,
      complaints: state.complaints, dailyExpenses: state.dailyExpenses
    });
    await loadCore();
    const after = JSON.stringify({
      members: state.members, meetings: state.meetings, ledger: state.ledger,
      cookingStaff: state.cookingStaff, waterDuty: state.waterDuty,
      weeklyVesselDuty: state.weeklyVesselDuty, supportPhone: state.supportPhone,
      vesselOverrides: state.vesselOverrides, cookingOverrides: state.cookingOverrides,
      complaints: state.complaints, dailyExpenses: state.dailyExpenses
    });
    if(before !== after && state.view !== "room"){ renderView(); renderChatFab(); }
  }catch(e){ /* offline or storage hiccup - ignore and try again next tick */ }
  syncing = false;
}
setInterval(syncNow, 6000);
document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) syncNow(); });
window.addEventListener("focus", syncNow);
window.addEventListener("online", syncNow);

(async function init(){
  await loadCore();
  render();
  initNotifications();
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}


