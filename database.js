// ms-villa-app / js/database.js
//
// App-wide constants (default members, rooms, duty rosters, ledger seed,
// icons, etc.) plus the shared data layer. All state lives on the global
// `state` object so the other js/*.js files (loaded as plain <script> tags,
// not ES modules) can read and mutate it directly, exactly like the
// original single-file build did.

const STORAGE_UNSET = "__unset__";
const DEFAULT_PASSWORD = "Msvilla@202";

const HOUSE_ICON = `<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>`;

// Real photos of the house, used as lightly blurred hero backgrounds.
const IMAGES = {
  living: "assets/images/living.jpg",
  kitchen: "assets/images/kitchen.jpg",
  bedroomA: "assets/images/bedroomA.jpg",
  bedroomB: "assets/images/bedroomB.jpg"
}
function heroWrap(imgKey, innerHtml){
  const src = IMAGES[imgKey] || IMAGES.living;
  return `<div class="photo-hero">
    <img class="hero-img" src="${src}" alt="">
    <div class="hero-overlay"></div>
    <div class="hero-inner">${innerHtml}</div>
  </div>`;
}
function imageForRoom(roomId){
  if(roomId==="living") return "living";
  if(roomId==="kitchen") return "kitchen";
  if(roomId==="bedroomA") return "bedroomA";
  if(roomId==="bedroomB") return "bedroomB";
  return "living";
}

const DEFAULT_MEMBERS = [
  { username:"Narendra@35", name:"Narendra", admin:true },
  { username:"Gana@12", name:"Ganapathi" },
  { username:"Surendra@35", name:"Surendra" },
  { username:"Rakesh@45", name:"Rakesh" },
  { username:"Chandrakanth@30", name:"Chandra Kanth" },
  { username:"Taj@45", name:"Taj" },
  { username:"Mahammad@88", name:"Mahammad" },
  { username:"Naveen@20", name:"Naveen" },
  { username:"Yashwanth@46", name:"Yashwanth" },
  { username:"Sreekanth@98", name:"Sreekanth" },
  { username:"Mallikarjuna@25", name:"Mallikarjuna" },
  { username:"Dinesh@48", name:"Dinesh" }
];

const DEFAULT_ROOMS = [
  { id:"living", name:"Living Area", assigned:["Chandrakanth@30","Taj@45"] },
  { id:"kitchen", name:"Kitchen", assigned:[] },
  { id:"bedroomA", name:"Bed Room A", assigned:["Gana@12","Narendra@35","Rakesh@45"] },
  { id:"bedroomB", name:"Bed Room B", assigned:["Mallikarjuna@25","Mahammad@88","Sreekanth@98","Yashwanth@46","Naveen@20"] },
  { id:"bathroomA", name:"Bath Room A", assigned:[] },
  { id:"bathroomB", name:"Bath Room B", assigned:[] }
];

// Weekly vessel-washing duty (from the house's handwritten roster). 0=Sunday..6=Saturday
// These three are now editable by an admin from Settings and are persisted to the
// storage backend (ms-villa:cooking-staff / ms-villa:water-duty / ms-villa:vessel-weekly),
// so updates made in the app stick permanently instead of needing a code edit.
const DEFAULT_WEEKLY_VESSEL_DUTY = {
  0: "Taj@45",           // Sunday
  1: "Gana@12",          // Monday
  2: "Mallikarjuna@25",  // Tuesday
  3: "Rakesh@45",        // Wednesday
  4: "Yashwanth@46",     // Thursday
  5: "Mahammad@88",      // Friday
  6: "Sreekanth@98"      // Saturday
};
const DEFAULT_COOKING_STAFF = ["Narendra", "Bunty"];
const DEFAULT_WATER_CAN_DUTY = "Naveen@20";

const RENT_INFO = {
  upiId: "6304583216-2@axl",
  payeeName: "Ms Villa"
};

// Transcribed from the handwritten monthly ledger. Verify with admin before relying on exact figures.
// This is only the initial seed — an admin can edit it from Room Expenses, and edits are persisted.
const DEFAULT_LEDGER = {
  month: "September",
  rows: [
    { name:"Ganapathi", due:6000, paid:5050, status:"Balance ₹950" },
    { name:"Surendra (Navi)", due:6000, paid:2483, status:"Balance ₹3517" },
    { name:"Rakesh", due:6000, paid:6000, status:"Completed" },
    { name:"Naveen", due:6000, paid:6000, status:"Completed (₹3000 old bill cleared)" },
    { name:"Chandra Kanth", due:6000, paid:-608, status:"Old bills + geyser repair adjusted, balance -₹608" },
    { name:"Sreekanth", due:6000, paid:6000, status:"Completed" },
    { name:"Mallikarjuna", due:6000, paid:4950, status:"Completed" },
    { name:"Mahammad", due:6000, paid:5000, status:"Balance ₹1000" },
    { name:"Yashwanth", due:6000, paid:6000, status:"Completed" },
    { name:"Taj", due:6000, paid:6000, status:"Completed" }
  ],
  bills: [
    { label:"Room Rent", amount:21000 },
    { label:"Current / Electricity Bill", amount:1500 },
    { label:"August Month Bills", amount:14000 },
    { label:"TV & Home Theater Bill", amount:6200 }
  ],
  totalBills: 42700,
  totalBillsAuto: true,
  remaining: 17300,
  remainingAuto: false,
  remainingNote: "Carried forward as September's room expense"
};

const COMPLAINT_CATEGORIES = [
  "Washing Machine Maintenance",
  "Electrical / Wiring",
  "Plumbing / Water Leakage",
  "Gas Stove / Kitchen Appliance",
  "Wi-Fi / Internet",
  "Furniture / Fittings",
  "Cleanliness Issue",
  "Other"
];

const INSTRUCTIONS = [
"Vessels: Everyone must clean the vessels on their assigned day itself. Do not leave unwashed vessels for the next day.",
"Room Cleaning: Every room must be cleaned at least twice a week. Keep the floor, beds, tables, and other areas neat and tidy.",
"Hall Cleaning: Everyone is responsible for maintaining the hall clean and organized. Do not leave personal belongings, food items, or waste in the hall.",
"Waste Disposal: Everyone must throw waste in serial-wise order according to the assigned schedule. Do not skip your turn.",
"Dustbins: Always put waste inside the dustbin. Do not throw waste on the floor, outside the room, or in common areas.",
"Kitchen: After using the kitchen, clean the stove, platform, sink, and other areas used. Do not leave food waste behind.",
"Food & Leftovers: Do not leave leftover food uncovered. Dispose of spoiled or unwanted food properly.",
"Personal Belongings: Keep shoes, clothes, bags, and other personal items properly arranged. Avoid blocking common spaces.",
"Bathroom: Everyone should keep the bathroom clean after use. Do not leave water, soap, or other waste scattered around.",
"Common Responsibility: Cleaning is everyone's responsibility. Do not depend on one person to clean common areas.",
"Switches & Appliances: Switch off lights, fans, ACs, and other electrical appliances when leaving the room or common area.",
"Water: Avoid unnecessary wastage of water and make sure taps are properly closed after use.",
"Noise: Maintain reasonable noise levels, especially during sleeping and study hours.",
"Damage: Report any damage, leakage, electrical issue, or maintenance problem immediately.",
"Cooperation: Everyone is expected to follow the cleaning schedule and cooperate with others to maintain a clean and comfortable environment."
];

const ICONS = {
  living: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>`,
  kitchen: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3v8a4 4 0 0 0 8 0V3"/><path d="M8 3v8"/><path d="M17 3v18"/><path d="M14 8h6"/></svg>`,
  bedroomA: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6"/><path d="M3 18h18"/><path d="M5 10V6h6v4"/></svg>`,
  bedroomB: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6"/><path d="M3 18h18"/><path d="M13 10V6h6v4"/></svg>`,
  bathroomA: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-3z"/><path d="M7 12V6a2 2 0 0 1 3.5-1.3"/><path d="M8 20v2M16 20v2"/></svg>`,
  bathroomB: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-3z"/><path d="M7 12V6a2 2 0 0 1 3.5-1.3"/><path d="M8 20v2M16 20v2"/></svg>`,
  duty: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4M16 2v4M3 10h18"/><rect x="3" y="4" width="18" height="18" rx="2"/></svg>`,
  expenses: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  rent: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 10h20M6 15h4"/></svg>`,
  complaints: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 8v4M12 15h.01"/></svg>`,
  meetings: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="14" height="14" rx="2"/><path d="M17 9l4-2v10l-4-2"/></svg>`,
  dailyExpenses: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-4-1L3 20l1.1-3.3A8.4 8.4 0 0 1 3 11.5 8.5 8.5 0 0 1 11.5 3 8.5 8.5 0 0 1 21 11.5z"/></svg>`
};

const ROOM_NOTES = {
  living: "Shared seating area. Keep the sofa, tables, and floor free of personal items after use.",
  kitchen: "Gas stove, sink, and storage cabinets. Clean the platform and stove after every use.",
  bedroomA: "Shared bedroom — 3 residents.",
  bedroomB: "Shared bedroom — 5 residents.",
  bathroomA: "Keep water and soap off the floor after use.",
  bathroomB: "Keep water and soap off the floor after use."
};

function ledgerRowFor(username){
  const member = state.members.find(m=>m.username===username);
  if(!member) return null;
  const first = member.name.split(" ")[0].toLowerCase();
  return state.ledger.rows.find(r => r.name.toLowerCase().includes(first)) || null;
}

// --- Ledger auto-calculation helpers ---
// Total Bills can be auto-summed from the Shared Bills list, and Remaining
// Balance can be auto-derived from Total Bills minus what's been collected —
// but an admin can flip either one to manual entry from Edit Room Expenses,
// since real-world figures (carried-forward amounts, adjustments) don't
// always fit a clean formula.
function sumBills(ledger){
  return ledger.bills.reduce((s,b)=> s + (Number(b.amount)||0), 0);
}
function sumPaid(ledger){
  return ledger.rows.reduce((s,r)=> s + (Number(r.paid)||0), 0);
}
function effectiveTotalBills(ledger){
  return ledger.totalBillsAuto ? sumBills(ledger) : (Number(ledger.totalBills)||0);
}
function effectiveRemaining(ledger){
  return ledger.remainingAuto ? (effectiveTotalBills(ledger) - sumPaid(ledger)) : (Number(ledger.remaining)||0);
}

const $ = (sel, el=document) => el.querySelector(sel);
const app = $("#app");
const todayKey = () => new Date().toISOString().slice(0,10);
const nameFor = (username, members) => (members.find(m=>m.username===username)||{}).name || username;
const inr = (n) => (n<0? "-₹" + Math.abs(n).toLocaleString("en-IN") : "₹" + n.toLocaleString("en-IN"));

let state = {
  members: null,
  rooms: null,
  attendance: {},
  vesselOverrides: {},
  cookingOverrides: {},
  complaints: [],
  cookingStaff: null,
  waterDuty: null,
  weeklyVesselDuty: null,
  ledger: null,
  meetings: [],
  dailyExpenses: [], // {id, date:"YYYY-MM-DD", amount, reason, photo, addedBy, createdAt}
  supportPhone: null,
  session: null,   // {username}
  view: "login",
  roomId: null,
  pendingOtp: null // {phone, code, expiresAt}
};

// --- Shared storage layer -------------------------------------------------
// This app used to run inside a Claude artifact, backed by window.storage.
// Deployed standalone on Netlify, the equivalent shared store is a small
// serverless function (netlify/functions/data.js) backed by Netlify Blobs.
// Every device that opens the site reads/writes the same keys there, so
// everyone in the house sees the same data. localStorage is kept as a
// same-device fallback for when the function can't be reached (offline).
const DATA_ENDPOINT = "/.netlify/functions/data";

async function sset(key, value){
  localStorage.setItem(key, JSON.stringify(value)); // instant local echo
  try{
    await fetch(DATA_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value })
    });
  }catch(e){ console.error("sset (offline, saved locally only):", e); }
}
async function sget(key){
  try{
    const res = await fetch(`${DATA_ENDPOINT}?key=${encodeURIComponent(key)}`);
    if(res.ok){
      const { value } = await res.json();
      if(value !== null && value !== undefined){
        localStorage.setItem(key, JSON.stringify(value));
        return value;
      }
    }
  }catch(e){ /* offline - fall through to local cache below */ }
  const v = localStorage.getItem(key);
  return v ? JSON.parse(v) : null;
}

async function loadCore(){
  let members = await sget("ms-villa:members");
  if(!members){ members = DEFAULT_MEMBERS.map(m=>({...m, password:DEFAULT_PASSWORD})); await sset("ms-villa:members", members); }
  let rooms = await sget("ms-villa:rooms");
  if(!rooms){ rooms = DEFAULT_ROOMS; await sset("ms-villa:rooms", rooms); }
  let vesselOverrides = await sget("ms-villa:vessel-overrides") || {};
  let cookingOverrides = await sget("ms-villa:cooking-overrides") || {};
  let complaints = await sget("ms-villa:complaints") || [];

  let cookingStaff = await sget("ms-villa:cooking-staff");
  if(!cookingStaff){ cookingStaff = [...DEFAULT_COOKING_STAFF]; await sset("ms-villa:cooking-staff", cookingStaff); }
  let waterDuty = await sget("ms-villa:water-duty");
  if(!waterDuty){ waterDuty = DEFAULT_WATER_CAN_DUTY; await sset("ms-villa:water-duty", waterDuty); }
  let weeklyVesselDuty = await sget("ms-villa:vessel-weekly");
  if(!weeklyVesselDuty){ weeklyVesselDuty = {...DEFAULT_WEEKLY_VESSEL_DUTY}; await sset("ms-villa:vessel-weekly", weeklyVesselDuty); }
  let ledger = await sget("ms-villa:ledger");
  if(!ledger){ ledger = JSON.parse(JSON.stringify(DEFAULT_LEDGER)); await sset("ms-villa:ledger", ledger); }
  // Older saved ledgers won't have these auto-calculate flags yet — default them
  // to "off" so existing figures don't silently change for anyone already using the app.
  if(ledger.totalBillsAuto===undefined) ledger.totalBillsAuto = false;
  if(ledger.remainingAuto===undefined) ledger.remainingAuto = false;
  let meetings = await sget("ms-villa:meetings") || [];
  let dailyExpenses = await sget("ms-villa:daily-expenses") || [];
  let supportPhone = await sget("ms-villa:support-phone") || "";

  state.members = members;
  state.rooms = rooms;
  state.vesselOverrides = vesselOverrides;
  state.cookingOverrides = cookingOverrides;
  state.complaints = complaints;
  state.cookingStaff = cookingStaff;
  state.waterDuty = waterDuty;
  state.weeklyVesselDuty = weeklyVesselDuty;
  state.ledger = ledger;
  state.meetings = meetings;
  state.dailyExpenses = dailyExpenses;
  state.supportPhone = supportPhone;
}

// --- Daily Expenses helpers -------------------------------------------
function dailyExpensesFor(date){
  return state.dailyExpenses.filter(e=>e.date===date);
}
function dailyExpensesTotalFor(date){
  return dailyExpensesFor(date).reduce((s,e)=> s + (Number(e.amount)||0), 0);
}
async function saveDailyExpenses(){
  await sset("ms-villa:daily-expenses", state.dailyExpenses);
}

async function loadAttendance(roomId, date){
  const key = `ms-villa:attendance:${roomId}:${date}`;
  return (await sget(key)) || {};
}
async function saveAttendance(roomId, date, data){
  const key = `ms-villa:attendance:${roomId}:${date}`;
  await sset(key, data);
}

// --- Session persistence ---------------------------------------------
// auth.js sets state.session on successful login but (until now) never
// persisted it, so any refresh reset state.session to null and bounced
// the user back to the login screen. These helpers save/restore it so a
// refresh keeps you signed in. "Remember me" (localStorage, survives
// closing the browser) is the default; a session-only flavor
// (sessionStorage, cleared when the tab/browser closes but survives a
// plain refresh) is available for a "keep me logged in" checkbox once
// it exists in auth.js — see persistSession(session, remember).
const SESSION_KEY = "ms-villa:session";

function persistSession(session, remember){
  if(remember === undefined) remember = true; // default: stay signed in
  if(session){
    const payload = JSON.stringify(session);
    if(remember){
      localStorage.setItem(SESSION_KEY, payload);
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      sessionStorage.setItem(SESSION_KEY, payload);
      localStorage.removeItem(SESSION_KEY);
    }
  } else {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }
}

function restoreSession(){
  try{
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    if(!raw) return null;
    const session = JSON.parse(raw);
    if(session && session.username && state.members.some(m=>m.username===session.username)){
      return session;
    }
  }catch(e){}
  return null;
}

function vesselOrder(){ return state.members.map(m=>m.username); }
function vesselDutyFor(date){
  if(state.vesselOverrides[date]) return state.vesselOverrides[date];
  const day = new Date(date+"T00:00:00Z").getUTCDay();
  return state.weeklyVesselDuty[day] || null;
}
function cookingStaffFor(date){
  if(state.cookingOverrides[date] && state.cookingOverrides[date].length) return state.cookingOverrides[date];
  return state.cookingStaff;
}

