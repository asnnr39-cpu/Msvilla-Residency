// ms-villa-app / js/admin.js
//
// Admin-only editing modals: room expenses/ledger, adding a new member,
// and duty-roster assignments. These are opened from buttons that are only
// rendered for members with `admin:true` (see app.js). Each save also
// pings notifyMembers() from notifications.js so residents get a push
// when something shared changes.

function openEditExpensesModal(){
  // work on a deep copy so Cancel doesn't mutate state
  const draft = JSON.parse(JSON.stringify(state.ledger));

  const wrap = document.createElement("div");
  wrap.className = "modal-bg";
  document.body.appendChild(wrap);

  function rowHtml(r, i){
    return `
      <div class="member-row" style="align-items:flex-start; flex-wrap:wrap; gap:8px 10px;">
        <input type="text" class="e-row-name" data-i="${i}" value="${r.name}" placeholder="Member name" style="flex:1 1 140px; margin-bottom:0;">
        <input type="text" inputmode="numeric" class="e-row-due" data-i="${i}" value="${r.due}" placeholder="Due" style="width:80px; margin-bottom:0;">
        <input type="text" inputmode="numeric" class="e-row-paid" data-i="${i}" value="${r.paid}" placeholder="Paid" style="width:80px; margin-bottom:0;">
        <input type="text" class="e-row-status" data-i="${i}" value="${r.status}" placeholder="Status note" style="flex:1 1 100%; margin-bottom:0;">
        <span data-remove-row="${i}" style="color:var(--danger); font-size:12px; cursor:pointer;">Remove member row</span>
      </div>
    `;
  }
  function billHtml(b, i){
    return `
      <div class="member-row" style="gap:8px 10px;">
        <input type="text" class="e-bill-label" data-i="${i}" value="${b.label}" placeholder="Bill label" style="flex:1; margin-bottom:0;">
        <input type="text" inputmode="numeric" class="e-bill-amount" data-i="${i}" value="${b.amount}" placeholder="Amount" style="width:90px; margin-bottom:0;">
        <span data-remove-bill="${i}" style="color:var(--danger); font-size:12px; cursor:pointer;">Remove</span>
      </div>
    `;
  }

  function renderModal(){
    wrap.innerHTML = `
      <div class="modal">
        <h3>Edit Room Expenses</h3>
        <label>Ledger month / label</label>
        <input type="text" id="e-month" value="${draft.month}">

        <div class="section-title" style="padding:0; margin:14px 0 6px;">Member Dues</div>
        ${draft.rows.map(rowHtml).join("")}
        <button type="button" class="btn-ghost" id="e-add-row" style="margin-top:2px;">+ Add Member Row</button>

        <div class="section-title" style="padding:0; margin:18px 0 6px;">Shared Bills</div>
        ${draft.bills.map(billHtml).join("")}
        <button type="button" class="btn-ghost" id="e-add-bill" style="margin-top:2px;">+ Add Bill</button>

        <div class="section-title" style="padding:0; margin:18px 0 6px;">Totals</div>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
          <input type="checkbox" id="e-total-bills-auto" ${draft.totalBillsAuto ? "checked" : ""} style="width:auto; margin:0;">
          <span>Auto-calculate from Shared Bills above</span>
        </label>
        <label>Total Bills</label>
        <input type="text" inputmode="numeric" id="e-total-bills" value="${draft.totalBillsAuto ? sumBills(draft) : draft.totalBills}" ${draft.totalBillsAuto ? "readonly" : ""}>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; margin-top:-4px;">
          <input type="checkbox" id="e-remaining-auto" ${draft.remainingAuto ? "checked" : ""} style="width:auto; margin:0;">
          <span>Auto-calculate (Total Bills &minus; Total Collected)</span>
        </label>
        <label>Remaining Balance</label>
        <input type="text" inputmode="numeric" id="e-remaining" value="${draft.remainingAuto ? (sumBills(draft) - sumPaid(draft)) : draft.remaining}" ${draft.remainingAuto ? "readonly" : ""}>
        <label>Remaining balance note</label>
        <input type="text" id="e-remaining-note" value="${draft.remainingNote}">

        <div class="error" id="e-err" style="display:none;"></div>
        <button class="btn-primary" id="e-save" style="margin-top:14px;">Save Changes</button>
        <button class="btn-ghost" id="e-cancel">Cancel</button>
      </div>
    `;

    wrap.querySelector("#e-cancel").onclick = ()=> wrap.remove();

    wrap.querySelector("#e-add-row").onclick = ()=>{
      draft.rows.push({ name:"", due:0, paid:0, status:"" });
      renderModal();
    };
    wrap.querySelector("#e-add-bill").onclick = ()=>{
      draft.bills.push({ label:"", amount:0 });
      renderModal();
    };
    wrap.querySelectorAll("[data-remove-row]").forEach(el=>{
      el.onclick = ()=>{ draft.rows.splice(parseInt(el.getAttribute("data-remove-row"),10),1); renderModal(); };
    });
    wrap.querySelectorAll("[data-remove-bill]").forEach(el=>{
      el.onclick = ()=>{ draft.bills.splice(parseInt(el.getAttribute("data-remove-bill"),10),1); renderModal(); };
    });

    // Keeps Total Bills / Remaining Balance in sync live as bill amounts or
    // paid amounts are typed, whenever their "auto-calculate" box is checked.
    // Toggling a checkbox flips that field between the live computed value
    // and a plain editable one the admin can type over.
    function recalcAutoFields(){
      const tbAuto = wrap.querySelector("#e-total-bills-auto").checked;
      const remAuto = wrap.querySelector("#e-remaining-auto").checked;
      const tbInput = wrap.querySelector("#e-total-bills");
      const remInput = wrap.querySelector("#e-remaining");
      const billsSum = Array.from(wrap.querySelectorAll(".e-bill-amount")).reduce((s,el)=> s + (Number(el.value)||0), 0);
      const paidSum = Array.from(wrap.querySelectorAll(".e-row-paid")).reduce((s,el)=> s + (Number(el.value)||0), 0);

      tbInput.readOnly = tbAuto;
      tbInput.style.opacity = tbAuto ? .6 : 1;
      if(tbAuto) tbInput.value = billsSum;

      const effectiveTB = tbAuto ? billsSum : (Number(tbInput.value)||0);
      remInput.readOnly = remAuto;
      remInput.style.opacity = remAuto ? .6 : 1;
      if(remAuto) remInput.value = effectiveTB - paidSum;
    }
    wrap.querySelectorAll(".e-bill-amount, .e-row-paid").forEach(el=>{ el.oninput = recalcAutoFields; });
    wrap.querySelector("#e-total-bills").oninput = recalcAutoFields;
    wrap.querySelector("#e-total-bills-auto").onchange = recalcAutoFields;
    wrap.querySelector("#e-remaining-auto").onchange = recalcAutoFields;
    recalcAutoFields();

    wrap.querySelector("#e-save").onclick = async ()=>{
      const err = wrap.querySelector("#e-err");
      err.style.display = "none";

      // pull latest field values into draft before validating/saving
      wrap.querySelectorAll(".e-row-name").forEach(el=> draft.rows[parseInt(el.getAttribute("data-i"),10)].name = el.value.trim());
      wrap.querySelectorAll(".e-row-due").forEach(el=> draft.rows[parseInt(el.getAttribute("data-i"),10)].due = Number(el.value)||0);
      wrap.querySelectorAll(".e-row-paid").forEach(el=> draft.rows[parseInt(el.getAttribute("data-i"),10)].paid = Number(el.value)||0);
      wrap.querySelectorAll(".e-row-status").forEach(el=> draft.rows[parseInt(el.getAttribute("data-i"),10)].status = el.value.trim());
      wrap.querySelectorAll(".e-bill-label").forEach(el=> draft.bills[parseInt(el.getAttribute("data-i"),10)].label = el.value.trim());
      wrap.querySelectorAll(".e-bill-amount").forEach(el=> draft.bills[parseInt(el.getAttribute("data-i"),10)].amount = Number(el.value)||0);
      draft.month = wrap.querySelector("#e-month").value.trim();
      draft.totalBillsAuto = wrap.querySelector("#e-total-bills-auto").checked;
      draft.remainingAuto = wrap.querySelector("#e-remaining-auto").checked;
      draft.totalBills = Number(wrap.querySelector("#e-total-bills").value)||0;
      draft.remaining = Number(wrap.querySelector("#e-remaining").value)||0;
      draft.remainingNote = wrap.querySelector("#e-remaining-note").value.trim();

      if(!draft.month){ err.style.display="block"; err.textContent="Please enter a ledger month/label."; return; }
      if(draft.rows.some(r=>!r.name)){ err.style.display="block"; err.textContent="Every member row needs a name."; return; }

      state.ledger = draft;
      await sset("ms-villa:ledger", state.ledger);
      wrap.remove();
      renderExpenses();
      notifyMembers("Room expenses updated", "An admin just updated the shared ledger and bills.");
    };
  }

  renderModal();
}


function openAddMemberModal(){
  const wrap = document.createElement("div");
  wrap.className = "modal-bg";
  wrap.innerHTML = `
    <div class="modal">
      <h3>Add Member</h3>
      <label>Full name</label>
      <input type="text" id="new-name" placeholder="e.g. Suresh">
      <label>Username (as they'll log in with)</label>
      <input type="text" id="new-username" placeholder="e.g. Suresh@10">
      <div class="error" id="add-error" style="display:none;"></div>
      <button class="btn-primary" id="save-member">Add — default password Msvilla@202</button>
      <button class="btn-ghost" id="cancel-member">Cancel</button>
    </div>
  `;
  document.body.appendChild(wrap);
  wrap.querySelector("#cancel-member").onclick = ()=> wrap.remove();
  wrap.querySelector("#save-member").onclick = async ()=>{
    const name = wrap.querySelector("#new-name").value.trim();
    const username = wrap.querySelector("#new-username").value.trim();
    const err = wrap.querySelector("#add-error");
    if(!name || !username){ err.style.display="block"; err.textContent="Please fill in both fields."; return; }
    if(state.members.some(m=>m.username===username)){ err.style.display="block"; err.textContent="That username already exists."; return; }
    if(state.members.length>=15){ err.style.display="block"; err.textContent="Ms Villa is limited to 15 members."; return; }
    state.members.push({ username, name, password: DEFAULT_PASSWORD });
    await sset("ms-villa:members", state.members);
    wrap.remove();
    renderSettings();
  };
}


function openEditDutyModal(){
  const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const today = todayKey();
  const memberOptions = (selected) => state.members.map(m=>
    `<option value="${m.username}" ${m.username===selected?'selected':''}>${m.name}</option>`
  ).join("");
  const dayRows = dayNames.map((dn,i)=>`
    <label>${dn}</label>
    <select class="vessel-day" data-day="${i}">${memberOptions(state.weeklyVesselDuty[i])}</select>
  `).join("");

  const todayOverrideUname = state.vesselOverrides[today] || "";
  const todayOverrideOptions = `<option value="">— Use weekly schedule —</option>` + state.members.map(m=>
    `<option value="${m.username}" ${m.username===todayOverrideUname?'selected':''}>${m.name}</option>`
  ).join("");
  const todayCookingOverride = (state.cookingOverrides[today] || []).join(", ");

  const wrap = document.createElement("div");
  wrap.className = "modal-bg";
  wrap.innerHTML = `
    <div class="modal">
      <h3>Edit Duty Assignments</h3>

      <div class="section-title" style="padding:0; margin:0 0 6px;">Today Only — Override</div>
      <label>Today's Vessel Cleaning Duty</label>
      <select id="d-today-vessel">${todayOverrideOptions}</select>
      <label>Today's Cooking Staff (comma separated, leave blank to use default)</label>
      <input type="text" id="d-today-cooking" value="${todayCookingOverride}" placeholder="${state.cookingStaff.join(", ")}">

      <div class="section-title" style="padding:0; margin:18px 0 6px;">Default / Standing Assignments</div>
      <label>Cooking Staff (comma separated)</label>
      <input type="text" id="d-cooking" value="${state.cookingStaff.join(", ")}">
      <label>Water Can Refill</label>
      <select id="d-water">${memberOptions(state.waterDuty)}</select>
      <div class="section-title" style="padding:0; margin:14px 0 6px;">Weekly Vessel Cleaning Duty</div>
      ${dayRows}
      <div class="error" id="d-err" style="display:none;"></div>
      <button class="btn-primary" id="d-save" style="margin-top:14px;">Save Changes</button>
      <button class="btn-ghost" id="d-cancel">Cancel</button>
    </div>
  `;
  document.body.appendChild(wrap);
  wrap.querySelector("#d-cancel").onclick = ()=> wrap.remove();
  wrap.querySelector("#d-save").onclick = async ()=>{
    const cookingRaw = wrap.querySelector("#d-cooking").value.trim();
    const err = wrap.querySelector("#d-err");
    if(!cookingRaw){ err.style.display="block"; err.textContent="Please enter at least one cooking staff name."; return; }

    const newCooking = cookingRaw.split(",").map(s=>s.trim()).filter(Boolean);
    const newWater = wrap.querySelector("#d-water").value;
    const newWeekly = {};
    wrap.querySelectorAll(".vessel-day").forEach(sel=>{
      newWeekly[parseInt(sel.getAttribute("data-day"),10)] = sel.value;
    });

    state.cookingStaff = newCooking;
    state.waterDuty = newWater;
    state.weeklyVesselDuty = newWeekly;

    // Today-only overrides
    const todayVesselChoice = wrap.querySelector("#d-today-vessel").value;
    if(todayVesselChoice){ state.vesselOverrides[today] = todayVesselChoice; }
    else { delete state.vesselOverrides[today]; }

    const todayCookingRaw = wrap.querySelector("#d-today-cooking").value.trim();
    if(todayCookingRaw){ state.cookingOverrides[today] = todayCookingRaw.split(",").map(s=>s.trim()).filter(Boolean); }
    else { delete state.cookingOverrides[today]; }

    await sset("ms-villa:cooking-staff", state.cookingStaff);
    await sset("ms-villa:water-duty", state.waterDuty);
    await sset("ms-villa:vessel-weekly", state.weeklyVesselDuty);
    await sset("ms-villa:vessel-overrides", state.vesselOverrides);
    await sset("ms-villa:cooking-overrides", state.cookingOverrides);

    wrap.remove();
    renderDuty();
    notifyMembers("Duty roster updated", "An admin just changed the cleaning, cooking, or water duty schedule.");
  };
}

