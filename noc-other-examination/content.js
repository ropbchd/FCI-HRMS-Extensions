// FCI NOC Assistant - Content Script
// Runs on every NOC review page.
// Checks action history and routes to the correct next step.
// v4.5 — Explicit sessionStorage routing for all stages (content.js as single source of truth)

(function () {

// --- CONFIGURATION ---

// STAGE 1 trigger: Last Dispatched = MAYURESH KUMAR, next = AMIT KUMAR SINGH (Pending Review, N/A)
// Action: Add Reviewer = ABHIMANYU SWAMI (276695)
const STAGE1_DISPATCHER_NAME  = 'MAYURESH KUMAR';
const STAGE1_NEXT_NAME        = 'AMIT KUMAR SINGH';
const STAGE1_NEXT_ACTION      = 'Pending Review';
const STAGE1_NEXT_REMARK      = 'N/A';

// STAGE 2 trigger: Last Reviewed = ABHIMANYU SWAMI (276695), next = AMIT KUMAR SINGH (Pending Review, N/A)
// Action: Add Reviewer = one of three assistants based on Cadre + Office
const STAGE2_LAST_REVIEWER_NAME   = 'ABHIMANYU SWAMI';
const STAGE2_LAST_REVIEWER_NUMBER = '276695';
const STAGE2_NEXT_NAME            = 'AMIT KUMAR SINGH';
const STAGE2_NEXT_ACTION          = 'Pending Review';
const STAGE2_NEXT_REMARK          = 'N/A';

// Assistant routing for Stage 2
const ASSISTANT_GENERAL = { name: 'MADHU DHAKA',     empNo: '313284' };
const ASSISTANT_DIVYA   = { name: 'DIVYA KORNU',     empNo: '315172' };
const ASSISTANT_VISHALI = { name: 'VISHALI MARWAHA', empNo: '308235' };

const DIVYA_OFFICES = [
'RO CHANDIGARH', 'DO PATIALA', 'DO LUDHIANA', 'DO JALANDHAR',
'DO FARIDKOT', 'DO HOSHIARPUR', 'DO AMRITSAR'
];
const VISHALI_OFFICES = [
'DO KAPURTHALA', 'DO FEROZEPUR', 'DO CHANDIGARH', 'DO BHATINDA',
'DO MOGA', 'DO GURDASPUR', 'DO SANGRUR'
];

const ASSISTANT_REMARK = 'Kindly review for admin. clearance and check for the details.';
const PERFORMA_REMARK   = 'Kindly provide the details as per the performa provided by the FCI, Zonal Office (N).';
const STAGE1C_REMARK = 'With respect to the application made by the employee, kindly provide the vigilance clearance for the purpose of NOC for other exam.';
const STAGE1C_TARGET_NAME   = 'ABHIMANYU SWAMI';
const STAGE1C_TARGET_NUMBER = '276695';

// STAGE 3: Last Reviewed = one of the three assistants, next = AMIT KUMAR SINGH (Pending Review, N/A)
// AND that last reviewed remark contains the key sentence → fill Reviewer Remarks directly on this page
const STAGE3_KEY_SENTENCE_RAW = 'the said request has been found to be in order and in accordance with the applicable policies, circulars, and advisories presently in';
const STAGE3_KEY_SENTENCE = STAGE3_KEY_SENTENCE_RAW.toLowerCase().replace(/\s+/g, ' ');

const STAGE3_REMARK_NON_RO = 'With reference to the application for a No Objection Certificate (NOC) to appear in another examination, it is respectfully submitted that the employee is clear from the vigilance perspective at the Divisional Office and Regional Office, and the administrative clearances from the Divisional and Regional Offices are also in place. The request is in compliance with the previously issued advisory on such matters. In view of the above, and considering that all requisite clearances have been duly obtained, if agreed, the NOC for appearing in the said examination may kindly be approved.';

const STAGE3_REMARK_RO = 'With reference to the application for a No Objection Certificate (NOC) to appear in another examination, it is respectfully submitted that the employee is clear from the vigilance  and administrative perspective at  Regional Office, level. The request is in compliance with the previously issued advisory on such matters. In view of the above, and considering that all requisite clearances have been duly obtained, if agreed, the NOC for appearing in the said examination may kindly be approved.';

// STAGE 3B / 3C: Designation landmark used to find the DO Manager
const AGM_DESIGNATION = 'Assistant General Manager';

// Stage 1D: Technical Error Handler
const STAGE1D_TECHNICAL_ERROR_KEYWORDS = [
'attachments submitted with the request are not accessible',
'technical error',
'cannot be reviewed',
'not accessible for viewing or downloading'
];

// Stage 3E: Pending Vigilance Case Handler
const STAGE3E_VIGILANCE_KEYWORDS = [
'PENDING',
'INVOLVED',
'UNDER CONTEMPLATION',
'CONTEMPLATION',
'NOT CLEAR',
'NOT FREE',
'VIGILANCE CASE',
'DISCIPLINARY PROCEEDINGS',
'CHARGE SHEET',
'PENDING CASE',
'PENDING PROCEEDINGS'
];

// Used exclusively to determine whether the assistant's remark contradicts
// BALJIT's vigilance clearance — triggering the mismatchClear condition.
// Vocabulary deliberately aligned with STAGE3E_VIGILANCE_KEYWORDS for consistency.
const VIGILANCE_MISMATCH_PATTERNS = [
/pending/i,
/under\s+contemplation/i,
/not\s+free/i,
/not\s+vigilance\s+(clear|free)/i,
/vigilance\s+case/i,
/disciplinary\s+proceedings/i,
/charge\s*-?\s*sheet/i,
/not\s+clear/i,
/involved/i
];

// Office Type values on the Add Reviewer page
const OFFICE_TYPE_RO = '4';
const OFFICE_TYPE_DO = '5';

// RO CHANDIGARH constant — used by multiple stages
const RO_CHANDIGARH = 'RO CHANDIGARH';

// Performa checkpoint: identifies when assistant's review follows a performa request
const PERFORMA_CHECKPOINT = 'performa provided by the FCI';

// BALJIT's standard Hindi phrase for "vigilance clear"
// Normalized: remove ALL whitespace characters
const BALJIT_CLEAR_HINDI_RAW = 'सतर्कता दृष्टिकोण से मुक्त है';
const BALJIT_CLEAR_HINDI = BALJIT_CLEAR_HINDI_RAW.replace(/\s+/g, '');

// Flexible BALJIT detection: also accept partial keyword matches
// Core concept: "सतर्कता" (vigilance) + "मुक्त" (free) near each other
const BALJIT_CLEAR_KEYWORDS = ['सतर्कता', 'मुक्त'];

// Mismatch remark: when BALJIT says NOT CLEAR but assistant says "in order"
const MISMATCH_REMARK_NOT_CLEAR = 'Kindly re-examine the request. As per vigilance records, the concerned employee is not vigilance free.';
// ----------------------

// === Floating Window Bridge — cached workflow state ===
let _fciWorkflowCache = {
  requestId: null,
  entries: null,
  cadreValue: null,
  officeValue: null,
  isRoChandigarh: null,
  hasRecommendation: false,
  recommendedSummary: null,
  // Precomputed payloads for all three paths
  payloadRecommended: null,
  payloadReexamine: null,
  payloadReturnPrevious: null
};

// --- SESSIONSTORAGE HELPERS ---

function writeFpPayload(key, data) {
  // key = 'recommended' | 'reexamine' | 'returnprevious'
  // data = { name, emp?, office, officeType, remark }
  if (!data || !data.name) {
    console.warn('[FCI NOC Assistant] writeFpPayload: invalid data for key "' + key + '"');
    return;
  }
  sessionStorage.setItem('fp.chosen', key);
  sessionStorage.setItem('fp.route.' + key + '.name',    data.name);
  sessionStorage.setItem('fp.route.' + key + '.office',  data.office);
  sessionStorage.setItem('fp.route.' + key + '.officeType', data.officeType);
  sessionStorage.setItem('fp.remark.' + key,             data.remark);
  if (data.emp) {
    sessionStorage.setItem('fp.route.' + key + '.emp', data.emp);
  } else {
    sessionStorage.removeItem('fp.route.' + key + '.emp');
  }
}

function writeLegacyPayload(stage, data) {
  // data = { officeType, office, name, emp?, remark }
  sessionStorage.setItem('fci_noc_stage',                stage);
  sessionStorage.setItem('fci_noc_office_type',          data.officeType);
  sessionStorage.setItem('fci_noc_target_office',        data.office);
  sessionStorage.setItem('fci_noc_assistant_remark',     data.remark);
  if (data.emp) {
    sessionStorage.setItem('fci_noc_assistant_emp',    data.emp);
    sessionStorage.setItem('fci_noc_assistant_name',   data.name);
    sessionStorage.removeItem('fci_noc_target_employee_name');
  } else {
    sessionStorage.setItem('fci_noc_target_employee_name', data.name);
    sessionStorage.removeItem('fci_noc_assistant_emp');
    sessionStorage.removeItem('fci_noc_assistant_name');
  }
}


// Helper: Check if a remark contains technical error keywords
function hasTechnicalError(remark) {
const lowerRemark = remark.toLowerCase();
return STAGE1D_TECHNICAL_ERROR_KEYWORDS.some(function(keyword) {
return lowerRemark.includes(keyword);
});
}

// Helper: Check if a remark contains vigilance keywords
function hasVigilanceIssue(remark) {
const upperRemark = remark.toUpperCase();
return STAGE3E_VIGILANCE_KEYWORDS.some(function(keyword) {
return upperRemark.includes(keyword.toUpperCase());
});
}

// Helper: Check if BALJIT's remark indicates "vigilance clear"
// Strategy 1: exact phrase match (whitespace-normalized)
// Strategy 2: all core keywords present (tolerant of phrasing variations)
function isBaljitClear(remark) {
if (!remark) return false;
const normalizedRemark = remark.replace(/\s+/g, '');
if (normalizedRemark.includes(BALJIT_CLEAR_HINDI)) return true;
// Fallback: all core keywords must be present
const hasAllKeywords = BALJIT_CLEAR_KEYWORDS.every(function(kw) {
  return normalizedRemark.includes(kw);
});
return hasAllKeywords;
}

// Helper: Check if BALJIT's remark indicates "not clear" (vigilance keywords)
function isBaljitNotClear(remark) {
if (!remark) return false;
return hasVigilanceIssue(remark);
}

// Helper: Get BALJIT's vigilance status
function getBaljitStatus(remark) {
if (!remark) return 'missing';
if (isBaljitClear(remark)) return 'clear';
if (isBaljitNotClear(remark)) return 'notclear';
return 'ambiguous';
}

// Helper: Extract vigilance status description from BALJIT's remark for Stage 3E
function getVigilanceStatusFromBaljit(baljitRemark) {
if (!baljitRemark) return 'a <b>vigilance case</b>';
const upperRemark = baljitRemark.toUpperCase();
if (upperRemark.includes('UNDER CONTEMPLATION')) {
return 'a <b>vigilance case under contemplation</b>';
}
if (upperRemark.includes('PENDING') && upperRemark.includes('CASE')) {
return 'a <b>vigilance case pending</b>';
}
if (upperRemark.includes('PENDING')) {
return 'a <b>vigilance case pending</b>';
}
if (upperRemark.includes('INVOLVED')) {
return 'an <b>involved vigilance case</b>';
}
if (upperRemark.includes('CHARGE SHEET')) {
return 'a <b>vigilance case with charge sheet issued</b>';
}
if (upperRemark.includes('DISCIPLINARY PROCEEDINGS')) {
return '<b>disciplinary proceedings pending</b>';
}
if (upperRemark.includes('NOT CLEAR')) {
return 'a <b>vigilance case</b> (status: NOT CLEAR)';
}
return 'a <b>vigilance case</b>';
}

// Helper: Check if the assistant's review follows a performa request (Stage 1B)
function isPostPerforma(entries, assistantIndex) {
if (assistantIndex <= 0) return false;
const prevEntry = entries[assistantIndex - 1];
return prevEntry
&& prevEntry.employeeName.toUpperCase().includes('AMIT KUMAR SINGH')
&& prevEntry.actionTaken === 'New Reviewer Added'
&& prevEntry.remark.toLowerCase().includes(PERFORMA_CHECKPOINT.toLowerCase());
}

// Helper: Find the last BALJIT SINGH entry
function getLastBaljitEntry(entries) {
let lastBaljitIndex = -1;
for (let i = 0; i < entries.length; i++) {
if (entries[i].employeeName.toUpperCase().includes('BALJIT SINGH')) {
lastBaljitIndex = i;
}
}
return lastBaljitIndex !== -1 ? entries[lastBaljitIndex] : null;
}

// Helper: Get ordinal suffix for a number
function getOrdinal(n) {
if (n === 0) return '0th';
const lastDigit = n % 10;
const lastTwoDigits = n % 100;
if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
return n + 'th';
}
switch (lastDigit) {
case 1: return n + 'st';
case 2: return n + 'nd';
case 3: return n + 'rd';
default: return n + 'th';
}
}

// --- DATE VALIDATION HELPERS (Stage 3 OK remark date check) ---

function parseDateFromString(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const date = new Date(year, month, day);
    if (date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) {
      return date;
    }
  }
  return null;
}

function parseDateFromActionHistory(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{1,2})[\/](\d{1,2})[\/](\d{4})/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const date = new Date(year, month, day);
    if (date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) {
      return date;
    }
  }
  return null;
}

function extractFormFillingDate(remark) {
  if (!remark) return null;
  const patterns = [
    /application form was filled on (\d{1,2}[./]\d{1,2}[./]\d{4})/i,
    /has applied for the exam on (\d{1,2}[./]\d{1,2}[./]\d{4})/i,
    /application form has been filled on (\d{1,2}[./]\d{1,2}[./]\d{4})/i,
    /was filled on (\d{1,2}[./]\d{1,2}[./]\d{4})/i,
    /applied for the exam on (\d{1,2}[./]\d{1,2}[./]\d{4})/i
  ];
  for (let i = 0; i < patterns.length; i++) {
    const match = remark.match(patterns[i]);
    if (match) {
      return parseDateFromString(match[1]);
    }
  }
  return null;
}

function getHrmsInitiationDate(entries) {
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].actionTaken === 'Initiated' && entries[i].dateOfAction) {
      return parseDateFromActionHistory(entries[i].dateOfAction);
    }
  }
  return null;
}

function formatDate(date) {
  if (!date) return 'null';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return day + '.' + month + '.' + year;
}

// --- NOTIFICATION PANEL (visual only, non-blocking) ---

function showDateNotification(hrmsDate, formDate, dayDiff) {
  const existing = document.getElementById('fci-noc-date-notification');
  if (existing) existing.remove();

  const isSevere = dayDiff > 7;
  const panel = document.createElement('div');
  panel.id = 'fci-noc-date-notification';
  panel.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;width:380px;padding:18px 20px;border-radius:10px;font-family:Arial,sans-serif;font-size:13px;line-height:1.5;box-shadow:0 6px 24px rgba(0,0,0,0.25);transition:opacity 0.3s ease;';

  if (isSevere) {
    panel.style.backgroundColor = '#fff0f0';
    panel.style.border = '2px solid #dc3545';
    panel.style.color = '#721c24';
  } else {
    panel.style.backgroundColor = '#fff8e6';
    panel.style.border = '2px solid #ffc107';
    panel.style.color = '#856404';
  }

  const title = isSevere
    ? '⚠️ Date Mismatch — Exceeds 7-Day Window'
    : 'ℹ️ Date Mismatch — Within 7-Day Window';

  const message = isSevere
    ? 'HRMS initiation is <b>' + dayDiff + ' days</b> after the form filling date. This exceeds the permissible window under the circular.'
    : 'HRMS initiation is <b>' + dayDiff + ' day(s)</b> after the form filling date. Within the 7-day window.';

  panel.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">' +
      '<strong style="font-size:14px;">' + title + '</strong>' +
      '<button id="fci-noc-close-notif" style="background:none;border:none;font-size:18px;cursor:pointer;line-height:1;padding:0 0 0 10px;color:inherit;opacity:0.6;">&times;</button>' +
    '</div>' +
    '<div style="margin-bottom:10px;">' + message + '</div>' +
    '<div style="background:rgba(255,255,255,0.6);padding:10px 12px;border-radius:6px;font-size:12px;margin-bottom:10px;">' +
      '<div><b>Form Filled:</b> ' + formatDate(formDate) + '</div>' +
      '<div><b>HRMS Initiated:</b> ' + formatDate(hrmsDate) + '</div>' +
      '<div><b>Difference:</b> ' + dayDiff + ' day(s)</div>' +
    '</div>' +
    '<div style="font-size:11px;opacity:0.85;border-top:1px solid rgba(0,0,0,0.1);padding-top:8px;">' +
      'This is a non-blocking notification. The extension will continue filling the approval remark as per normal workflow.' +
    '</div>';

  document.body.appendChild(panel);

  document.getElementById('fci-noc-close-notif').addEventListener('click', function() {
    panel.style.opacity = '0';
    setTimeout(function() { panel.remove(); }, 300);
  });

  // Auto-dismiss after 30 seconds
  setTimeout(function() {
    if (document.getElementById('fci-noc-date-notification')) {
      panel.style.opacity = '0';
      setTimeout(function() { panel.remove(); }, 300);
    }
  }, 30000);
}

// ----------------------------------------------------------------

// Helper: Find the initiating employee (S.No. 1 - Initiated entry)
function getInitiatingEmployee(entries) {
for (let i = 0; i < entries.length; i++) {
if (entries[i].actionTaken === 'Initiated') {
return {
name: entries[i].employeeName,
office: entries[i].actionOffice || entries[i].office || null,
empNo: entries[i].employeeNumber || null
};
}
}
return null;
}

// Helper: Find the requesting employee (alias)
function getRequestingEmployee(entries) {
return getInitiatingEmployee(entries);
}

// Helper: Find the DO Manager (Admin.) via AGM landmark
// Returns the entry immediately preceding the first AGM entry with a non-empty, non-N/A remark.
function getDoManagerEntry(entries) {
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].designation.trim() === AGM_DESIGNATION
        && entries[i].remark.trim() !== 'N/A'
        && entries[i].remark.trim() !== '') {
      return i > 0 ? entries[i - 1] : null;
    }
  }
  return null;
}

// Helper: Read a specific field value from the page by its label's "for" attribute
function getFieldValue(fieldName) {
const listItems = document.querySelectorAll('li');
for (let li of listItems) {
const label = li.querySelector('label');
const span  = li.querySelector('span');
if (!label || !span) continue;
if (label.getAttribute('for') === fieldName) {
return span.textContent.trim();
}
}
return '';
}

// STEP 1: Click View Action History
let _viewActionHistoryRetries = 0;
const MAX_VIEW_ACTION_RETRIES = 5;

function clickViewActionHistory() {
let btn = document.querySelector('a.view-action-history');
if (!btn) {
const allLinks = document.querySelectorAll('a, button');
for (let el of allLinks) {
if (el.textContent.trim() === 'View Action History') { btn = el; break; }
}
}
if (btn) {
console.log('[FCI NOC Assistant] Step 1: Clicking "View Action History"...');
btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
waitForTableAndCheck();
} else {
_viewActionHistoryRetries++;
if (_viewActionHistoryRetries >= MAX_VIEW_ACTION_RETRIES) {
console.error('[FCI NOC Assistant] "View Action History" button not found after ' + MAX_VIEW_ACTION_RETRIES + ' attempts. Giving up.');
return;
}
console.warn('[FCI NOC Assistant] "View Action History" button not found. Retrying in 2s... (attempt ' + _viewActionHistoryRetries + '/' + MAX_VIEW_ACTION_RETRIES + ')');
setTimeout(clickViewActionHistory, 2000);
}
}

// --- Multi-Page Pagination ---
// Parse a single page's tbody into entries array
function parsePageEntries(tbody) {
const allRows = tbody.querySelectorAll('tr');
const pageEntries = [];
let currentEntry = null;
const MIN_DATA_COLUMNS = 6; // tolerate table structure changes (was 8)

for (let row of allRows) {
  const cells = row.querySelectorAll('td');
  // Data row: enough columns to hold S.No, Date, Version, Action, Name, Designation, Division, Authority
  if (cells.length >= MIN_DATA_COLUMNS) {
    currentEntry = {
      slNo:         cells[0] ? cells[0].textContent.trim() : '',
      dateOfAction: cells[1] ? cells[1].textContent.trim() : '',
      actionTaken:  cells[3] ? cells[3].textContent.trim() : '',
      employeeName: cells[4] ? cells[4].textContent.trim() : '',
      designation:  cells[5] ? cells[5].textContent.trim() : '',
      actionOffice: cells[2] ? cells[2].textContent.trim() : '',
      employeeNumber: (cells[4] && cells[4].textContent.match(/\d{6}/)) ? cells[4].textContent.match(/\d{6}/)[0] : '',
      remark:       ''
    };
    pageEntries.push(currentEntry);
  } else if (cells.length >= 1) {
    // Remark row: single cell containing REMARKS: text (tolerate any colSpan)
    const fullText = cells[0].textContent.trim();
    if (fullText.startsWith('REMARKS:') && currentEntry) {
      currentEntry.remark = fullText.replace('REMARKS:', '').trim();
    }
  }
}
return pageEntries;

}

// Get total number of pages from pagination controls
function getTotalPages() {
const paginateDivs = document.querySelectorAll('[id$="_paginate"], .dataTables_paginate, .pagination');
let paginateDiv = null;
for (let div of paginateDivs) {
if (div.querySelectorAll('a, span').length > 0) {
paginateDiv = div;
break;
}
}
if (!paginateDiv) return 1;

const pageLinks = paginateDiv.querySelectorAll('a, span');  
let highestNum = 0;  
for (let link of pageLinks) {  
  const text = link.textContent.trim();  
  const num = parseInt(text);  
  if (!isNaN(num) && text === String(num) && num > highestNum) {  
    highestNum = num;  
  }  
}  
return highestNum > 0 ? highestNum : 1;

}

// Click a specific page number in pagination
function clickPageNumber(targetPage) {
const paginateDivs = document.querySelectorAll('[id$="_paginate"], .dataTables_paginate, .pagination');
let paginateDiv = null;
for (let div of paginateDivs) {
if (div.querySelectorAll('a, span').length > 0) {
paginateDiv = div;
break;
}
}
if (!paginateDiv) return false;

const pageLinks = paginateDiv.querySelectorAll('a, span');  
for (let link of pageLinks) {  
  const text = link.textContent.trim();  
  const num = parseInt(text);  
  if (!isNaN(num) && text === String(num) && num === targetPage) {  
    if (!link.classList.contains('current') && !link.classList.contains('active')) {  
      console.log('[FCI NOC Assistant] Pagination: clicking page ' + targetPage);  
      link.click();  
      return true;  
    } else {  
      console.log('[FCI NOC Assistant] Pagination: already on page ' + targetPage);  
      return true;  
    }  
  }  
}  
return false;

}

// STEP 2: Wait for table to populate, then collect ALL pages before checking
function waitForTableAndCheck() {
let attempts = 0;
const interval = setInterval(function () {
attempts++;
const tbody = document.querySelector('#custom-action-history-tbl tbody');
if (tbody && tbody.querySelectorAll('tr').length > 0) {
clearInterval(interval);

const table = document.querySelector('#custom-action-history-tbl');  
    if (table) {  
      table.scrollIntoView({ behavior: 'smooth', block: 'start' });  
    }  

    console.log('[FCI NOC Assistant] Step 2: Table populated. Checking pagination...');  
    const totalPages = getTotalPages();  
    console.log('[FCI NOC Assistant] Total pages: ' + totalPages);  

    if (totalPages <= 1) {  
      const entries = parsePageEntries(tbody);  
      console.log('[FCI NOC Assistant] Single page. Entries collected: ' + entries.length);  
      checkConditionsAndAct(entries, tbody);  
    } else {  
      collectAllPages(totalPages, function(allEntries) {  
        console.log('[FCI NOC Assistant] All pages collected. Total entries: ' + allEntries.length);  
        const finalTbody = document.querySelector('#custom-action-history-tbl tbody');  
        checkConditionsAndAct(allEntries, finalTbody);  
      });  
    }  
  } else if (attempts >= 20) {  
    clearInterval(interval);  
    console.warn('[FCI NOC Assistant] Table did not load in time.');  
  }  
}, 500);

}

// Collect entries from all pages sequentially
function collectAllPages(totalPages, callback) {
let allEntries = [];
let currentPage = 1;

const initialTbody = document.querySelector('#custom-action-history-tbl tbody');  
if (initialTbody) {  
  const page1Entries = parsePageEntries(initialTbody);  
  allEntries = allEntries.concat(page1Entries);  
  console.log('[FCI NOC Assistant] Page 1 collected: ' + page1Entries.length + ' entries');  
}  

if (totalPages === 1) {  
  callback(allEntries);  
  return;  
}  

function collectNextPage() {  
  currentPage++;  
  if (currentPage > totalPages) {  
    callback(allEntries);  
    return;  
  }  

  const clicked = clickPageNumber(currentPage);  
  if (!clicked) {  
    console.warn('[FCI NOC Assistant] Could not click page ' + currentPage + '. Aborting pagination.');  
    callback(allEntries);  
    return;  
  }  

  let attempts = 0;  
  const waitInterval = setInterval(function () {  
    attempts++;  
    const tbody = document.querySelector('#custom-action-history-tbl tbody');  
    if (tbody && tbody.querySelectorAll('tr').length > 0) {  
      const firstRow = tbody.querySelector('tr');  
      if (firstRow) {  
        const cells = firstRow.querySelectorAll('td');  
        if (cells.length >= 1) {  
          const slNo = cells[0].textContent.trim();  
          const expectedSlNo = (currentPage - 1) * 10 + 1;  
          if (parseInt(slNo) === expectedSlNo || parseInt(slNo) > (currentPage - 2) * 10) {  
            clearInterval(waitInterval);  
            const pageEntries = parsePageEntries(tbody);  
            allEntries = allEntries.concat(pageEntries);  
            console.log('[FCI NOC Assistant] Page ' + currentPage + ' collected: ' + pageEntries.length + ' entries');  
            setTimeout(collectNextPage, 800);  
            return;  
          }  
        }  
      }  
    }  
    if (attempts >= 30) {  
      clearInterval(waitInterval);  
      console.warn('[FCI NOC Assistant] Page ' + currentPage + ' did not load in time. Aborting pagination.');  
      callback(allEntries);  
    }  
  }, 500);  
}  

setTimeout(collectNextPage, 1000);

}

// Helper: Check if ABHIMANYU SWAMI has already reviewed in the action history
function isAbhimanyuInHistory(entries) {
for (let i = 0; i < entries.length; i++) {
if (entries[i].actionTaken === 'Reviewed'
&& entries[i].employeeName.toUpperCase().includes('ABHIMANYU SWAMI')) {
return true;
}
}
return false;
}

// Helper: Read Cadre and Office from the page
function getCadreAndOffice() {
const cadreValue = getFieldValue('cadre');
const officeValue = getFieldValue('office');
const isRoChandigarh = officeValue.trim().replace(/\s+/g, ' ').toUpperCase() === 'RO CHANDIGARH';
return { cadreValue, officeValue, isRoChandigarh };
}

// Helper: Highlight mismatch rows (BALJIT in red, Assistant in orange)
function highlightMismatch(tbody, baljitEntry, assistantEntry) {
const allRows = tbody.querySelectorAll('tr');

if (baljitEntry) {  
  for (let row of allRows) {  
    const cells = row.querySelectorAll('td');  
    if (cells.length === 8) {  
      const name = cells[4].textContent.trim().toUpperCase().replace(/\s+/g, ' ');  
      const action = cells[3].textContent.trim();  
      if (name.includes('BALJIT SINGH') && action === 'Reviewed') {  
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });  
        row.style.backgroundColor = '#ffcccc';  
        row.style.border = '3px solid #cc0000';  
        break;  
      }  
    }  
  }  
}  

if (assistantEntry) {  
  for (let row of allRows) {  
    const cells = row.querySelectorAll('td');  
    if (cells.length === 8) {  
      const name = cells[4].textContent.trim().toUpperCase().replace(/\s+/g, ' ');  
      const action = cells[3].textContent.trim();  
      const assistantNameNorm = assistantEntry.employeeName.toUpperCase().replace(/\s+/g, ' ');  
      if (name.includes(assistantNameNorm) && action === 'Reviewed') {  
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });  
        row.style.backgroundColor = '#ffe6cc';  
        row.style.border = '3px solid #ff6600';  
        break;  
      }  
    }  
  }  
}  

console.warn('[FCI NOC Assistant] ⚠️ MISMATCH DETECTED: BALJIT and Assistant disagree on vigilance status!');  
console.warn('[FCI NOC Assistant] ⚠️ BALJIT row highlighted in RED, Assistant row in ORANGE. Please review manually.');

}

// STEP 3: Decide which stage we are in
// Receives pre-built entries array + tbody for highlighting
function checkConditionsAndAct(entries, tbody) {
// --- POPULATE WORKFLOW CACHE ---
_fciWorkflowCache.entries        = entries;
_fciWorkflowCache.cadreValue     = getCadreAndOffice().cadreValue;
_fciWorkflowCache.officeValue    = getCadreAndOffice().officeValue;
_fciWorkflowCache.isRoChandigarh = getCadreAndOffice().isRoChandigarh;
_fciWorkflowCache.requestId      = getRequestId();

// --- READ CADRE AND OFFICE FIRST ---
const { cadreValue, officeValue, isRoChandigarh } = getCadreAndOffice();
console.log('[FCI NOC Assistant] Office read from page: "' + officeValue + '"');
console.log('[FCI NOC Assistant] Cadre read from page:  "' + cadreValue + '"');
console.log('[FCI NOC Assistant] isRoChandigarh: ' + isRoChandigarh);

const doManagerEntry = getDoManagerEntry(entries);  

// --- Check STAGE 2 ---  
let lastReviewedIndex = -1;  
for (let i = 0; i < entries.length; i++) {  
  if (entries[i].actionTaken === 'Reviewed') lastReviewedIndex = i;  
}  
const lastReviewed = lastReviewedIndex !== -1 ? entries[lastReviewedIndex] : null;  
const afterReviewed = lastReviewed ? entries[lastReviewedIndex + 1] || null : null;  

const stage2 = lastReviewed  
  && lastReviewed.employeeName.toUpperCase().includes(STAGE2_LAST_REVIEWER_NAME)  
  && afterReviewed  
  && afterReviewed.employeeName.toUpperCase().includes(STAGE2_NEXT_NAME)  
  && afterReviewed.actionTaken.trim() === STAGE2_NEXT_ACTION  
  && afterReviewed.remark.trim() === STAGE2_NEXT_REMARK;  

// --- Check STAGE 1 ---  
let lastDispatchedIndex = -1;  
for (let i = 0; i < entries.length; i++) {  
  if (entries[i].actionTaken === 'Dispatched') lastDispatchedIndex = i;  
}  
const lastDispatched = lastDispatchedIndex !== -1 ? entries[lastDispatchedIndex] : null;  
const afterDispatched = lastDispatched ? entries[lastDispatchedIndex + 1] || null : null;  

const stage1 = lastDispatched  
  && lastDispatched.employeeName.toUpperCase().includes(STAGE1_DISPATCHER_NAME)  
  && afterDispatched  
  && afterDispatched.employeeName.toUpperCase().includes(STAGE1_NEXT_NAME)  
  && afterDispatched.actionTaken.trim() === STAGE1_NEXT_ACTION  
  && afterDispatched.remark.trim() === STAGE1_NEXT_REMARK;  

// --- Find the last assistant reviewed entry ---  
const ASSISTANT_NAMES = ['MADHU DHAKA', 'DIVYA KORNU', 'VISHALI MARWAHA'];  

let lastAssistantReviewedIndex = -1;  
for (let i = 0; i < entries.length; i++) {  
  if (entries[i].actionTaken === 'Reviewed') {  
    const nameUpper = entries[i].employeeName.toUpperCase();  
    if (ASSISTANT_NAMES.some(function(n) { return nameUpper.includes(n); })) {  
      lastAssistantReviewedIndex = i;  
    }  
  }  
}  
const lastAssistantReviewed = lastAssistantReviewedIndex !== -1 ? entries[lastAssistantReviewedIndex] : null;  
const afterAssistantReviewed = lastAssistantReviewed ? entries[lastAssistantReviewedIndex + 1] || null : null;  

// --- Stage 3 key sentence check (whitespace-insensitive) ---  
const stage3KeyPresent = lastAssistantReviewed && (function() {  
  const normalizedRemark = lastAssistantReviewed.remark.toLowerCase().replace(/\s+/g, ' ');  
  const idx = normalizedRemark.indexOf(STAGE3_KEY_SENTENCE);  
  if (idx === -1) return false;  
  const preceding = normalizedRemark.substring(Math.max(0, idx - 25), idx);  
  return !(/\bnot\b/.test(preceding));  
})();  

// --- Get BALJIT's status (the pole point) ---  
const lastBaljit = getLastBaljitEntry(entries);  
const baljitRemark = lastBaljit ? lastBaljit.remark : '';  
const baljitStatus = getBaljitStatus(baljitRemark);  
const baljitClear    = (baljitStatus === 'clear');  
const baljitNotClear = (baljitStatus === 'notclear');  
const baljitAmbiguous = (baljitStatus === 'ambiguous');  

console.log('[FCI NOC Assistant] BALJIT status: ' + baljitStatus);  
console.log('[FCI NOC Assistant] BALJIT remark: "' + baljitRemark + '"');  

// --- Check base conditions (assistant reviewed + AMIT Pending) ---  
const baseConditions = lastAssistantReviewed  
  && afterAssistantReviewed  
  && afterAssistantReviewed.employeeName.toUpperCase().includes(STAGE2_NEXT_NAME)  
  && afterAssistantReviewed.actionTaken.trim() === STAGE2_NEXT_ACTION  
  && afterAssistantReviewed.remark.trim() === STAGE2_NEXT_REMARK;  

// --- Check post-performa flag ---  
const isPostPerformaFlag = isPostPerforma(entries, lastAssistantReviewedIndex);  

// --- Apply the Sync Gate Matrix (BALJIT as Pole Point) ---  

// Stage 3E: BALJIT says NOT CLEAR + Assistant NOT "in order"  
const stage3e = baseConditions && baljitNotClear && !stage3KeyPresent;  

// Stage 3: BALJIT says CLEAR + Assistant "in order"  
const stage3 = baseConditions && baljitClear && stage3KeyPresent;  

// MISMATCH Case 1: BALJIT CLEAR + Assistant NOT "in order" + assistant mentions  
// a contradictory vigilance phrase (exclude post-performa and non-vigilance objections)  
const assistantRemark = lastAssistantReviewed && lastAssistantReviewed.remark  
  ? lastAssistantReviewed.remark  
  : '';  
const assistantContradictsVigilance = VIGILANCE_MISMATCH_PATTERNS  
  .some(function(p) { return p.test(assistantRemark); });  

const mismatchClear = baseConditions  
  && baljitClear  
  && !stage3KeyPresent  
  && !isPostPerformaFlag  
  && assistantContradictsVigilance;  

// MISMATCH Case 2: BALJIT NOT CLEAR + Assistant "in order"  
const mismatchNotClear = baseConditions && baljitNotClear && stage3KeyPresent;  

// MISMATCH Case 3: BALJIT ambiguous (present but unclear)  
const mismatchAmbiguous = baseConditions && baljitAmbiguous;  

// Stage 3B — exclude ALL mismatch cases, non-RO only  
const stage3bAssistantIssue = lastAssistantReviewed  
  && !stage3KeyPresent  
  && lastAssistantReviewed.remark.trim() !== ''  
  && afterAssistantReviewed  
  && afterAssistantReviewed.employeeName.toUpperCase().includes(STAGE2_NEXT_NAME)  
  && afterAssistantReviewed.actionTaken.trim() === STAGE2_NEXT_ACTION  
  && afterAssistantReviewed.remark.trim() === STAGE2_NEXT_REMARK  
  && !stage3e  
  && !mismatchNotClear  
  && !mismatchClear  
  && !mismatchAmbiguous;  

const stage3b = stage3bAssistantIssue && !isRoChandigarh;  

// Stage 3D: RO CHANDIGARH assistant clarification — exclude ALL mismatch cases  
const abhimanyuPresent = isAbhimanyuInHistory(entries);  

const stage3d = lastAssistantReviewed  
  && !stage3KeyPresent  
  && lastAssistantReviewed.remark.trim() !== ''  
  && !isPostPerformaFlag  
  && afterAssistantReviewed  
  && afterAssistantReviewed.employeeName.toUpperCase().includes(STAGE2_NEXT_NAME)  
  && afterAssistantReviewed.actionTaken.trim() === STAGE2_NEXT_ACTION  
  && afterAssistantReviewed.remark.trim() === STAGE2_NEXT_REMARK  
  && isRoChandigarh  
  && !stage3e  
  && !mismatchNotClear  
  && !mismatchClear  
  && !mismatchAmbiguous;  

// Stage 3C  
let lastAmitPendingIndex = -1;  
for (let i = 0; i < entries.length; i++) {  
  if (entries[i].employeeName.toUpperCase().includes(STAGE2_NEXT_NAME)  
      && entries[i].actionTaken.trim() === STAGE2_NEXT_ACTION  
      && entries[i].remark.trim() === STAGE2_NEXT_REMARK) {  
    lastAmitPendingIndex = i;  
  }  
}  
const entryBeforeAmitPending = lastAmitPendingIndex > 0 ? entries[lastAmitPendingIndex - 1] : null;  

const stage3c = doManagerEntry  
  && entryBeforeAmitPending  
  && entryBeforeAmitPending.employeeName.toUpperCase().trim()  
       === doManagerEntry.employeeName.toUpperCase().trim()  
  && lastAmitPendingIndex !== -1  
  && !stage2  
  && !stage3  
  && !stage3e  
  && !stage3bAssistantIssue;  

// Stage 1D: Technical Error Handler  
let technicalErrorIndex = -1;  
for (let i = 0; i < entries.length; i++) {  
  if (entries[i].actionTaken === 'Reviewed' && hasTechnicalError(entries[i].remark)) {  
    technicalErrorIndex = i;  
    break;  
  }  
}  

const techErrorEntry  = technicalErrorIndex !== -1 ? entries[technicalErrorIndex] : null;  
const afterTechError  = technicalErrorIndex !== -1 && technicalErrorIndex + 1 < entries.length ? entries[technicalErrorIndex + 1] : null;  
const afterTechError2 = technicalErrorIndex !== -1 && technicalErrorIndex + 2 < entries.length ? entries[technicalErrorIndex + 2] : null;  

const stage1d = techErrorEntry  
  && afterTechError  
  && afterTechError.actionTaken === 'Reviewed'  
  && afterTechError.employeeName.toUpperCase().includes('ABHIMANYU SWAMI')  
  && afterTechError2  
  && afterTechError2.employeeName.toUpperCase().includes(STAGE2_NEXT_NAME)  
  && afterTechError2.actionTaken.trim() === STAGE2_NEXT_ACTION  
  && afterTechError2.remark.trim() === STAGE2_NEXT_REMARK;  

// Stage 1C  
const stage1c = lastAssistantReviewed  
  && isPostPerformaFlag  
  && !abhimanyuPresent  
  && isRoChandigarh  
  && afterAssistantReviewed  
  && afterAssistantReviewed.employeeName.toUpperCase().includes(STAGE2_NEXT_NAME)  
  && afterAssistantReviewed.actionTaken.trim() === STAGE2_NEXT_ACTION  
  && afterAssistantReviewed.remark.trim() === STAGE2_NEXT_REMARK;  

// --- PRECOMPUTE ALTERNATIVE PAYLOADS FOR BRIDGE ---
const assistantForReexamine = decideAssistant(cadreValue, officeValue);
if (assistantForReexamine) {
  _fciWorkflowCache.payloadReexamine = {
    name: assistantForReexamine.name,
    emp: assistantForReexamine.empNo,
    office: RO_CHANDIGARH,
    officeType: OFFICE_TYPE_RO,
    remark: 'Kindly re-examine the request in light of the applicable rules and circulars of the Corporation.'
  };
}

const doMgr = getDoManagerEntry(entries);
if (isRoChandigarh) {
  const initiatingEmployee = getInitiatingEmployee(entries);
  if (initiatingEmployee) {
    _fciWorkflowCache.payloadReturnPrevious = {
      name: initiatingEmployee.name,
      office: RO_CHANDIGARH,
      officeType: OFFICE_TYPE_RO,
      remark: 'The observations recorded in the action history may kindly be perused, and the requisite clarification, confirmation, or documentation furnished for further processing of the request.'
    };
  }
} else if (doMgr) {
  _fciWorkflowCache.payloadReturnPrevious = {
    name: doMgr.employeeName,
    office: officeValue.trim().replace(/\s+/g, ' ').toUpperCase(),
    officeType: OFFICE_TYPE_DO,
    remark: 'The observations recorded in the action history may kindly be perused, and the requisite clarification, confirmation, or documentation furnished for further processing of the request.'
  };
}

// --- PERSIST ALTERNATIVE PAYLOADS TO SESSIONSTORAGE ---
// This ensures they survive page navigation to Add Reviewer.
if (_fciWorkflowCache.payloadReexamine) {
  const p = _fciWorkflowCache.payloadReexamine;
  sessionStorage.setItem('fp.route.reexamine.name', p.name);
  if (p.emp) sessionStorage.setItem('fp.route.reexamine.emp', p.emp);
  sessionStorage.setItem('fp.route.reexamine.office', p.office);
  sessionStorage.setItem('fp.route.reexamine.officeType', p.officeType);
  sessionStorage.setItem('fp.remark.reexamine', p.remark);
}

if (_fciWorkflowCache.payloadReturnPrevious) {
  const p = _fciWorkflowCache.payloadReturnPrevious;
  sessionStorage.setItem('fp.route.returnprevious.name', p.name);
  // emp is not used for returnprevious
  sessionStorage.setItem('fp.route.returnprevious.office', p.office);
  sessionStorage.setItem('fp.route.returnprevious.officeType', p.officeType);
  sessionStorage.setItem('fp.remark.returnprevious', p.remark);
}

// --- LOGGING ---  
console.log('[FCI NOC Assistant] Stage 3  (Fill Approval Remark):                  ' + (stage3  ? 'MATCH' : 'no match'));  
console.log('[FCI NOC Assistant] Stage 3E (Fill Rejection Remark):                 ' + (stage3e ? 'MATCH' : 'no match'));  
console.log('[FCI NOC Assistant] MISMATCH (BALJIT Clear + Assistant NOT in order): ' + (mismatchClear    ? '⚠️ MISMATCH' : 'no match'));  
console.log('[FCI NOC Assistant] MISMATCH (BALJIT Not Clear + Assistant in order): ' + (mismatchNotClear ? '⚠️ MISMATCH' : 'no match'));  
console.log('[FCI NOC Assistant] MISMATCH (BALJIT Ambiguous):                      ' + (mismatchAmbiguous ? '⚠️ MISMATCH' : 'no match'));  
console.log('[FCI NOC Assistant] Stage 3B (Send back to DO Manager):               ' + (stage3b ? 'MATCH' : 'no match'));  
console.log('[FCI NOC Assistant] Stage 3D (Send back to Initiating Official - RO): ' + (stage3d ? 'MATCH' : 'no match'));  
console.log('[FCI NOC Assistant] Stage 3C (Re-send to assistant):                  ' + (stage3c ? 'MATCH' : 'no match'));  
console.log('[FCI NOC Assistant] Stage 1D (Technical Error Handler):               ' + (stage1d ? 'MATCH' : 'no match'));  
console.log('[FCI NOC Assistant] Stage 2  (Send to Assistant):                     ' + (stage2  ? 'MATCH' : 'no match'));  
console.log('[FCI NOC Assistant] Stage 1C (Send to ABHIMANYU after performa):      ' + (stage1c ? 'MATCH' : 'no match'));  
console.log('[FCI NOC Assistant] Stage 1  (Send to ABHIMANYU SWAMI):               ' + (stage1  ? 'MATCH' : 'no match'));  

if (doManagerEntry) {  
  console.log('[FCI NOC Assistant] DO Manager identified: "' + doManagerEntry.employeeName + '" (S.No. ' + doManagerEntry.slNo + ')');  
}  

// --- PRIORITY ORDER: 3E → 3 → MISMATCH → 3B → 3D → 3C → 1D → 2 → 1C → 1B → 1 ---  

if (stage3e) {  
  const assistantName = lastAssistantReviewed ? lastAssistantReviewed.employeeName : 'Assistant';  
  console.log('[FCI NOC Assistant] Stage 3E: Filling rejection proposal remark...');
  _fciWorkflowCache.hasRecommendation = true;
  _fciWorkflowCache.recommendedSummary = 'Stage 3E — Filling rejection proposal remark (vigilance case pending)';
  highlightTriggerRow(tbody, assistantName, 'Reviewed');  

  const employeeName   = getFieldValue('employee_name') || 'the official';  
  const designation    = getFieldValue('designation') || '';  
  const cadre          = getFieldValue('cadre') || '';  
  const examName       = getFieldValue('examination_name') || 'the examination';  
  const nocApprovedStr = getFieldValue('nNOCApproved') || '0';  
  const nocCount       = parseInt(nocApprovedStr, 10) || 0;  
  const ordinalCount   = getOrdinal(nocCount + 1);  
  const vigilanceStatus = getVigilanceStatusFromBaljit(baljitRemark);  

  const stage3eRemark = 'Sh. ' + employeeName + ', ' + designation + ' (' + cadre + '), has requested issuance of an NOC to appear in the ' + examName + '. While the official is clear from the administrative and vigilance angles at DO level and administrative angle at RO level, the official is not clear from the vigilance angle at RO level as there is ' + vigilanceStatus + ' against the official. This is the ' + ordinalCount + ' NOC request of the official for the current calendar year. As per FCI HQ Circular No. 01-2019-05 dated 17.01.2019 read with DoPT O.M. dated 23.12.2013, applications of officials with pending vigilance/prosecution issues cannot be forwarded or considered. In view of the above, the present request for issuance of NOC for appearing in the ' + examName + ' may be <b>rejected/reverted</b> in accordance with the said circular, for kind consideration and further necessary directions please.';  

  setTimeout(function() { fillReviewerRemarks(stage3eRemark, true); }, 2000);  

} else if (stage3) {  
  const assistantName = lastAssistantReviewed ? lastAssistantReviewed.employeeName : 'Assistant';  
  console.log('[FCI NOC Assistant] Stage 3: Filling approval remark...');
  _fciWorkflowCache.hasRecommendation = true;
  _fciWorkflowCache.recommendedSummary = 'Stage 3 — Filling approval remark (request is in order)';
  
  // --- Date validation: HRMS initiation date vs form filling date (visual notification only) ---
  const hrmsDate = getHrmsInitiationDate(entries);
  const formDate = extractFormFillingDate(lastAssistantReviewed ? lastAssistantReviewed.remark : '');
  if (hrmsDate && formDate) {
    if (hrmsDate > formDate) {
      const oneDay = 24 * 60 * 60 * 1000;
      const dayDiff = Math.round((hrmsDate - formDate) / oneDay);
      showDateNotification(hrmsDate, formDate, dayDiff);
      console.warn('[FCI NOC Assistant] ⚠️ DATE MISMATCH: HRMS (' + formatDate(hrmsDate) + ') is ' + dayDiff + ' day(s) AFTER form date (' + formatDate(formDate) + '). Notification shown. Proceeding with approval remark.');
    } else {
      console.log('[FCI NOC Assistant] Date check passed: HRMS date (' + formatDate(hrmsDate) + ') <= Form date (' + formatDate(formDate) + ').');
    }
  } else {
    console.log('[FCI NOC Assistant] Date check skipped: Could not extract HRMS date or form date from remark.');
  }

  highlightTriggerRow(tbody, assistantName, 'Reviewed');  
  const remarkToFill = isRoChandigarh ? STAGE3_REMARK_RO : STAGE3_REMARK_NON_RO;  
  setTimeout(function() { fillReviewerRemarks(remarkToFill, false); }, 2000);  

} else if (mismatchNotClear) {  
  const assistantName = lastAssistantReviewed ? lastAssistantReviewed.employeeName : 'Assistant';  
  console.log('[FCI NOC Assistant] ⚠️ MISMATCH: Sending back to Assistant: ' + assistantName);  
  highlightMismatch(tbody, lastBaljit, lastAssistantReviewed);
  _fciWorkflowCache.hasRecommendation = true;
  _fciWorkflowCache.recommendedSummary = 'Mismatch — Sending back to ' + assistantName + ' for correction';
  
  sessionStorage.setItem('fp.chosen',                    'recommended');
  sessionStorage.setItem('fp.route.recommended.name',    assistantName);
  sessionStorage.setItem('fp.route.recommended.office',  RO_CHANDIGARH);
  sessionStorage.setItem('fp.route.recommended.officeType', OFFICE_TYPE_RO);
  sessionStorage.setItem('fp.remark.recommended',        MISMATCH_REMARK_NOT_CLEAR);

  sessionStorage.setItem('fci_noc_stage',                '3mismatch');  
  sessionStorage.setItem('fci_noc_office_type',          OFFICE_TYPE_RO);  
  sessionStorage.setItem('fci_noc_target_office',        RO_CHANDIGARH);  
  sessionStorage.setItem('fci_noc_target_employee_name', assistantName);  
  sessionStorage.setItem('fci_noc_assistant_remark',     MISMATCH_REMARK_NOT_CLEAR);  
  sessionStorage.removeItem('fci_noc_assistant_emp');  
  sessionStorage.removeItem('fci_noc_assistant_name');  
  setTimeout(clickAddReviewer, 2000);  

} else if (mismatchClear || mismatchAmbiguous) {  
  console.log('[FCI NOC Assistant] ⚠️ MISMATCH detected. Please review manually.');  
  highlightMismatch(tbody, lastBaljit, lastAssistantReviewed);
  _fciWorkflowCache.hasRecommendation = false;
  _fciWorkflowCache.recommendedSummary = null;  

} else if (stage3b) {  
  if (!doManagerEntry) {  
    console.warn('[FCI NOC Assistant] Stage 3B: Could not identify DO Manager. No action taken.');  
    return;  
  }  
  const assistantSlNo = lastAssistantReviewed.slNo;  
  const assistantName = lastAssistantReviewed.employeeName;  
  const doManagerName = doManagerEntry.employeeName;  
  const stage3bRemark = 'Reference may be made to the observations recorded during examination of the request at Sl. No. ' + assistantSlNo + '. Required necessary clarifications and/or supporting documents, as indicated, may kindly be furnished for further processing.';  

  console.log('[FCI NOC Assistant] Stage 3B: Sending back to DO Manager: ' + doManagerName);  
  highlightTriggerRow(tbody, assistantName, 'Reviewed');
  _fciWorkflowCache.hasRecommendation = true;
  _fciWorkflowCache.recommendedSummary = 'Stage 3B — Sending back to DO Manager ' + doManagerName;
  
  sessionStorage.setItem('fp.chosen',                    'recommended');
  sessionStorage.setItem('fp.route.recommended.name',    doManagerName);
  sessionStorage.setItem('fp.route.recommended.office',  officeValue.trim().replace(/\s+/g, ' ').toUpperCase());
  sessionStorage.setItem('fp.route.recommended.officeType', OFFICE_TYPE_DO);
  sessionStorage.setItem('fp.remark.recommended',        stage3bRemark);

  sessionStorage.setItem('fci_noc_stage',                '3b');  
  sessionStorage.setItem('fci_noc_office_type',          OFFICE_TYPE_DO);  
  sessionStorage.setItem('fci_noc_target_office',        officeValue.trim().replace(/\s+/g, ' ').toUpperCase());  
  sessionStorage.setItem('fci_noc_target_employee_name', doManagerName);  
  sessionStorage.setItem('fci_noc_assistant_remark',     stage3bRemark);  
  sessionStorage.removeItem('fci_noc_assistant_emp');  
  sessionStorage.removeItem('fci_noc_assistant_name');  
  setTimeout(clickAddReviewer, 2000);  

} else if (stage3d) {  
  const initiatingEmployee = getInitiatingEmployee(entries);  
  if (!initiatingEmployee) {  
    console.warn('[FCI NOC Assistant] Stage 3D: Could not identify initiating employee. No action taken.');  
    return;  
  }  
  const assistantSlNo  = lastAssistantReviewed.slNo;  
  const assistantName  = lastAssistantReviewed.employeeName;  
  const initiatingName = initiatingEmployee.name;  
  const stage3dRemark  = 'Reference may be made to the observations recorded during examination of the request at Sl. No. ' + assistantSlNo + '. Required necessary clarifications and/or supporting documents, as indicated, may kindly be furnished for further processing.';  

  console.log('[FCI NOC Assistant] Stage 3D: Sending back to initiating official: ' + initiatingName);  
  highlightTriggerRow(tbody, assistantName, 'Reviewed');
  _fciWorkflowCache.hasRecommendation = true;
  _fciWorkflowCache.recommendedSummary = 'Stage 3D — Sending back to initiating official ' + initiatingName;
  
  sessionStorage.setItem('fp.chosen',                    'recommended');
  sessionStorage.setItem('fp.route.recommended.name',    initiatingName);
  sessionStorage.setItem('fp.route.recommended.office',  RO_CHANDIGARH);
  sessionStorage.setItem('fp.route.recommended.officeType', OFFICE_TYPE_RO);
  sessionStorage.setItem('fp.remark.recommended',        stage3dRemark);

  sessionStorage.setItem('fci_noc_stage',                '3d');  
  sessionStorage.setItem('fci_noc_office_type',          OFFICE_TYPE_RO);  
  sessionStorage.setItem('fci_noc_target_office',        RO_CHANDIGARH);  
  sessionStorage.setItem('fci_noc_target_employee_name', initiatingName);  
  sessionStorage.setItem('fci_noc_assistant_remark',     stage3dRemark);  
  sessionStorage.removeItem('fci_noc_assistant_emp');  
  sessionStorage.removeItem('fci_noc_assistant_name');  
  setTimeout(clickAddReviewer, 2000);  

} else if (stage3c) {  
  const assistant = decideAssistant(cadreValue, officeValue);  
  if (!assistant) return;  
  console.log('[FCI NOC Assistant] Stage 3C: Re-routing to ' + assistant.name + '...');  
  highlightTriggerRow(tbody, doManagerEntry.employeeName, entryBeforeAmitPending.actionTaken);
  _fciWorkflowCache.hasRecommendation = true;
  _fciWorkflowCache.recommendedSummary = 'Stage 3C — Re-routing to ' + assistant.name;
  
  writeFpPayload('recommended', {
    name: assistant.name, emp: assistant.empNo,
    office: RO_CHANDIGARH, officeType: OFFICE_TYPE_RO,
    remark: ASSISTANT_REMARK
  });
  sessionStorage.setItem('fci_noc_stage',            '3c');  
  sessionStorage.setItem('fci_noc_office_type',      OFFICE_TYPE_RO);  
  sessionStorage.setItem('fci_noc_target_office',    RO_CHANDIGARH);  
  sessionStorage.setItem('fci_noc_assistant_emp',    assistant.empNo);  
  sessionStorage.setItem('fci_noc_assistant_name',   assistant.name);  
  sessionStorage.setItem('fci_noc_assistant_remark', ASSISTANT_REMARK);  
  sessionStorage.removeItem('fci_noc_target_employee_name');  
  setTimeout(clickAddReviewer, 2000);  

} else if (stage1d) {  
  console.log('[FCI NOC Assistant] Stage 1D: Technical error detected.');
  _fciWorkflowCache.hasRecommendation = true;
  _fciWorkflowCache.recommendedSummary = 'Stage 1D — Technical error: sending back for re-upload';
  
  if (isRoChandigarh) {  
    const requestingEmployee = getRequestingEmployee(entries);  
    if (!requestingEmployee) {  
      console.warn('[FCI NOC Assistant] Stage 1D (RO): Could not identify requesting employee. No action taken.');  
      return;  
    }  
    const technicalRemark = 'The attachments submitted with the request are not accessible for viewing or downloading due to a technical error. Kindly re-submit the required documents/attachments for further processing.';  
    highlightTriggerRow(tbody, techErrorEntry.employeeName, 'Reviewed');  

    sessionStorage.setItem('fp.chosen',                    'recommended');
    sessionStorage.setItem('fp.route.recommended.name',    requestingEmployee.name);
    sessionStorage.setItem('fp.route.recommended.office',  RO_CHANDIGARH);
    sessionStorage.setItem('fp.route.recommended.officeType', OFFICE_TYPE_RO);
    sessionStorage.setItem('fp.remark.recommended',        technicalRemark);

    sessionStorage.setItem('fci_noc_stage',                '1d-ro');  
    sessionStorage.setItem('fci_noc_office_type',          OFFICE_TYPE_RO);  
    sessionStorage.setItem('fci_noc_target_office',        RO_CHANDIGARH);  
    sessionStorage.setItem('fci_noc_target_employee_name', requestingEmployee.name);  
    sessionStorage.setItem('fci_noc_assistant_remark',     technicalRemark);  
    sessionStorage.removeItem('fci_noc_assistant_emp');  
    sessionStorage.removeItem('fci_noc_assistant_name');  
    setTimeout(clickAddReviewer, 2000);  

  } else {  
    if (!doManagerEntry) {  
      console.warn('[FCI NOC Assistant] Stage 1D (Non-RO): Could not identify DO Manager. No action taken.');  
      return;  
    }  
    const technicalRemark = 'Due to an inadvertent technical issue, the documents earlier uploaded for processing the request are not accessible, as the attachments are not opening. It is therefore requested to kindly upload the requisite documents again and resubmit the request for further processing.';  
    highlightTriggerRow(tbody, techErrorEntry.employeeName, 'Reviewed');  

    sessionStorage.setItem('fp.chosen',                    'recommended');
    sessionStorage.setItem('fp.route.recommended.name',    doManagerEntry.employeeName);
    sessionStorage.setItem('fp.route.recommended.office',  officeValue.trim().replace(/\s+/g, ' ').toUpperCase());
    sessionStorage.setItem('fp.route.recommended.officeType', OFFICE_TYPE_DO);
    sessionStorage.setItem('fp.remark.recommended',        technicalRemark);

    sessionStorage.setItem('fci_noc_stage',                '1d-do');  
    sessionStorage.setItem('fci_noc_office_type',          OFFICE_TYPE_DO);  
    sessionStorage.setItem('fci_noc_target_office',        officeValue.trim().replace(/\s+/g, ' ').toUpperCase());  
    sessionStorage.setItem('fci_noc_target_employee_name', doManagerEntry.employeeName);  
    sessionStorage.setItem('fci_noc_assistant_remark',     technicalRemark);  
    sessionStorage.removeItem('fci_noc_assistant_emp');  
    sessionStorage.removeItem('fci_noc_assistant_name');  
    setTimeout(clickAddReviewer, 2000);  
  }  

} else if (stage2) {  
  const assistant = decideAssistant(cadreValue, officeValue);  
  if (assistant) {  
    console.log('[FCI NOC Assistant] Stage 2: Routing to ' + assistant.name + '...');  
    highlightTriggerRow(tbody, 'ABHIMANYU SWAMI', 'Reviewed');
    _fciWorkflowCache.hasRecommendation = true;
    _fciWorkflowCache.recommendedSummary = 'Stage 2 — Routing to ' + assistant.name + ' for admin. clearance';
    
    sessionStorage.setItem('fp.chosen',                    'recommended');
    sessionStorage.setItem('fp.route.recommended.name',    assistant.name);
    sessionStorage.setItem('fp.route.recommended.emp',     assistant.empNo);
    sessionStorage.setItem('fp.route.recommended.office',    RO_CHANDIGARH);
    sessionStorage.setItem('fp.route.recommended.officeType', OFFICE_TYPE_RO);
    sessionStorage.setItem('fp.remark.recommended',        ASSISTANT_REMARK);

    sessionStorage.setItem('fci_noc_stage',            '2');  
    sessionStorage.setItem('fci_noc_office_type',      OFFICE_TYPE_RO);  
    sessionStorage.setItem('fci_noc_target_office',    RO_CHANDIGARH);  
    sessionStorage.setItem('fci_noc_assistant_emp',    assistant.empNo);  
    sessionStorage.setItem('fci_noc_assistant_name',   assistant.name);  
    sessionStorage.setItem('fci_noc_assistant_remark', ASSISTANT_REMARK);  
    sessionStorage.removeItem('fci_noc_target_employee_name');  
    setTimeout(clickAddReviewer, 2000);  
  }  

} else if (stage1c) {  
  console.log('[FCI NOC Assistant] Stage 1C: Sending to ABHIMANYU SWAMI for vigilance clearance...');  
  highlightTriggerRow(tbody, lastAssistantReviewed.employeeName, 'Reviewed');
  _fciWorkflowCache.hasRecommendation = true;
  _fciWorkflowCache.recommendedSummary = 'Stage 1C — Sending to ABHIMANYU SWAMI for vigilance clearance';
  
  sessionStorage.setItem('fp.chosen',                    'recommended');
  sessionStorage.setItem('fp.route.recommended.name',    STAGE1C_TARGET_NAME);
  sessionStorage.setItem('fp.route.recommended.emp',       STAGE1C_TARGET_NUMBER);
  sessionStorage.setItem('fp.route.recommended.office',  RO_CHANDIGARH);
  sessionStorage.setItem('fp.route.recommended.officeType', OFFICE_TYPE_RO);
  sessionStorage.setItem('fp.remark.recommended',        STAGE1C_REMARK);

  sessionStorage.setItem('fci_noc_stage',            '1c');  
  sessionStorage.setItem('fci_noc_office_type',      OFFICE_TYPE_RO);  
  sessionStorage.setItem('fci_noc_target_office',    RO_CHANDIGARH);  
  sessionStorage.setItem('fci_noc_assistant_emp',    STAGE1C_TARGET_NUMBER);  
  sessionStorage.setItem('fci_noc_assistant_name',   STAGE1C_TARGET_NAME);  
  sessionStorage.setItem('fci_noc_assistant_remark', STAGE1C_REMARK);  
  sessionStorage.removeItem('fci_noc_target_employee_name');  
  setTimeout(clickAddReviewer, 2000);  

} else if (stage1 && isRoChandigarh) {  
  const assistant = decideAssistant(cadreValue, officeValue);  
  if (assistant) {  
    console.log('[FCI NOC Assistant] Stage 1B: Routing to ' + assistant.name + '...');  
    highlightTriggerRow(tbody, 'MAYURESH KUMAR', 'Dispatched');
    _fciWorkflowCache.hasRecommendation = true;
    _fciWorkflowCache.recommendedSummary = 'Stage 1B — Routing to ' + assistant.name + ' for performa';
    
    sessionStorage.setItem('fp.chosen',                    'recommended');
    sessionStorage.setItem('fp.route.recommended.name',    assistant.name);
    sessionStorage.setItem('fp.route.recommended.emp',     assistant.empNo);
    sessionStorage.setItem('fp.route.recommended.office',    RO_CHANDIGARH);
    sessionStorage.setItem('fp.route.recommended.officeType', OFFICE_TYPE_RO);
    sessionStorage.setItem('fp.remark.recommended',        PERFORMA_REMARK);

    sessionStorage.setItem('fci_noc_stage',            '1b');  
    sessionStorage.setItem('fci_noc_office_type',      OFFICE_TYPE_RO);  
    sessionStorage.setItem('fci_noc_target_office',    RO_CHANDIGARH);  
    sessionStorage.setItem('fci_noc_assistant_emp',    assistant.empNo);  
    sessionStorage.setItem('fci_noc_assistant_name',   assistant.name);  
    sessionStorage.setItem('fci_noc_assistant_remark', PERFORMA_REMARK);  
    sessionStorage.removeItem('fci_noc_target_employee_name');  
    setTimeout(clickAddReviewer, 2000);  
  }  

} else if (stage1) {  
  // Stage 1: FIXED — now explicitly sets all routing data for ABHIMANYU SWAMI  
  console.log('[FCI NOC Assistant] Stage 1: Routing to ABHIMANYU SWAMI...');  
  highlightTriggerRow(tbody, 'MAYURESH KUMAR', 'Dispatched');
  _fciWorkflowCache.hasRecommendation = true;
  _fciWorkflowCache.recommendedSummary = 'Stage 1 — Routing to ABHIMANYU SWAMI for vigilance clearance';
  
  sessionStorage.setItem('fp.chosen',                    'recommended');
  sessionStorage.setItem('fp.route.recommended.name',    STAGE1C_TARGET_NAME);
  sessionStorage.setItem('fp.route.recommended.emp',     STAGE1C_TARGET_NUMBER);
  sessionStorage.setItem('fp.route.recommended.office',  RO_CHANDIGARH);
  sessionStorage.setItem('fp.route.recommended.officeType', OFFICE_TYPE_RO);
  sessionStorage.setItem('fp.remark.recommended',        STAGE1C_REMARK);

  sessionStorage.setItem('fci_noc_stage',            '1');  
  sessionStorage.setItem('fci_noc_office_type',      OFFICE_TYPE_RO);  
  sessionStorage.setItem('fci_noc_target_office',    RO_CHANDIGARH);  
  sessionStorage.setItem('fci_noc_assistant_emp',    STAGE1C_TARGET_NUMBER);  
  sessionStorage.setItem('fci_noc_assistant_name',   STAGE1C_TARGET_NAME);  
  sessionStorage.setItem('fci_noc_assistant_remark', STAGE1C_REMARK);  
  sessionStorage.removeItem('fci_noc_target_employee_name');  
  setTimeout(clickAddReviewer, 2000);  

} else {  
  console.log('[FCI NOC Assistant] No matching stage found. No action taken.');
  _fciWorkflowCache.hasRecommendation = false;
  _fciWorkflowCache.recommendedSummary = null;
}

  // Render floating panel now that bridge is populated
  if (window.FloatingWindow && typeof window.FloatingWindow.render === 'function') {
    window.FloatingWindow.render();
  } else {
    console.log('[FCI NOC Assistant] Floating window not available (expected if floating_window.js is not loaded).');
  }

}

// Highlight the trigger row with a flashing yellow effect
function highlightTriggerRow(tbody, targetName, targetAction) {
const allRows = tbody.querySelectorAll('tr');
let targetRow = null;

for (let row of allRows) {  
  const cells = row.querySelectorAll('td');  
  if (cells.length === 8) {  
    const action = cells[3].textContent.trim();  
    const name   = cells[4].textContent.trim().toUpperCase();  
    if (action === targetAction && name.includes(targetName.toUpperCase())) {  
      targetRow = row;  
    }  
  }  
}  

if (!targetRow) {  
  console.warn('[FCI NOC Assistant] Trigger row not found for highlighting.');  
  return;  
}  

targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });  

const originalBg = targetRow.style.backgroundColor;  
let flashCount = 0;  
const flashInterval = setInterval(function () {  
  flashCount++;  
  targetRow.style.backgroundColor = (flashCount % 2 === 1) ? '#fff3cd' : '';  
  if (flashCount >= 6) {  
    clearInterval(flashInterval);  
    targetRow.style.backgroundColor = '#fff3cd';  
    setTimeout(function () { targetRow.style.backgroundColor = originalBg; }, 1800);  
  }  
}, 300);

}

// Read Cadre and Office from the page and return the correct assistant
function decideAssistant(cadre, office) {
const cadreValue  = cadre.trim().replace(/\s+/g, ' ').toUpperCase();
const officeValue = office.trim().replace(/\s+/g, ' ').toUpperCase();

console.log('[FCI NOC Assistant] Cadre: "' + cadreValue + '" | Office: "' + officeValue + '"');  

if (cadreValue === 'GENERAL') {  
  return ASSISTANT_GENERAL;  
} else if (cadreValue === 'DEPOT') {  
  if (DIVYA_OFFICES.map(o => o.trim().replace(/\s+/g, ' ').toUpperCase()).includes(officeValue)) {  
    return ASSISTANT_DIVYA;  
  } else if (VISHALI_OFFICES.map(o => o.trim().replace(/\s+/g, ' ').toUpperCase()).includes(officeValue)) {  
    return ASSISTANT_VISHALI;  
  } else {  
    console.warn('[FCI NOC Assistant] Cadre is Depot but Office "' + officeValue + '" is not in any known group. No action taken.');  
    return null;  
  }  
} else {  
  console.warn('[FCI NOC Assistant] Unrecognised Cadre: "' + cadreValue + '". No action taken.');  
  return null;  
}

}

// Fill Reviewer Remarks box on the Review page
function fillReviewerRemarks(remarkText, useHtml) {
const editor  = document.getElementById('editor');
const textarea = document.getElementById('dop_member_comment');

if (!editor) {  
  console.warn('[FCI NOC Assistant] Reviewer Remarks editor (#editor) not found. Retrying...');  
  setTimeout(function() { fillReviewerRemarks(remarkText, useHtml); }, 1500);  
  return;  
}  

editor.scrollIntoView({ behavior: 'smooth', block: 'center' });  

if (useHtml) {  
  editor.innerHTML = remarkText;  
} else {  
  editor.innerText = remarkText;  
}  

if (textarea) {  
  const tempDiv = document.createElement('div');  
  tempDiv.innerHTML = remarkText;  
  textarea.value = tempDiv.textContent || tempDiv.innerText || '';  
}  

editor.dispatchEvent(new Event('input', { bubbles: true }));  
editor.dispatchEvent(new Event('blur',  { bubbles: true }));  

console.log('[FCI NOC Assistant] Reviewer Remarks filled successfully.');  
console.log('[FCI NOC Assistant] *** Please review the remark and click Review/Submit yourself. ***');

}

// Click the Add Reviewer button
function clickAddReviewer() {
let addReviewerBtn = null;
const allLinks = document.querySelectorAll('a, button');
for (let el of allLinks) {
if (el.textContent.trim() === 'Add Reviewer') { addReviewerBtn = el; break; }
}
if (addReviewerBtn) {
sessionStorage.setItem('fci_noc_triggered', 'yes');
console.log('[FCI NOC Assistant] Clicking "Add Reviewer"...');
addReviewerBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
} else {
console.warn('[FCI NOC Assistant] "Add Reviewer" button not found.');
}
}

// ----------------------------------------------------------------

// --- BRIDGE IMPLEMENTATION ---

window.FCIWorkflow = {
  getWorkflowContext: function() {
    return {
      requestId: _fciWorkflowCache.requestId,
      hasRecommendation: _fciWorkflowCache.hasRecommendation,
      recommendedSummary: _fciWorkflowCache.recommendedSummary
    };
  },

  executeReExamine: function() {
    const payload = _fciWorkflowCache.payloadReexamine;
    if (!payload) {
      console.warn('[FCI Workflow Assistant] Re-examine: payload not precomputed. No action taken.');
      return;
    }
    sessionStorage.setItem('fp.chosen',                    'reexamine');
    sessionStorage.setItem('fp.route.reexamine.name',      payload.name);
    sessionStorage.setItem('fp.route.reexamine.emp',       payload.emp);
    sessionStorage.setItem('fp.route.reexamine.office',    payload.office);
    sessionStorage.setItem('fp.route.reexamine.officeType', payload.officeType);
    sessionStorage.setItem('fp.remark.reexamine',          payload.remark);
    clickAddReviewer();
  },

  executeReturnPrevious: function() {
    const payload = _fciWorkflowCache.payloadReturnPrevious;
    if (!payload) {
      console.warn('[FCI Workflow Assistant] Return to Previous: payload not precomputed. No action taken.');
      return;
    }
    sessionStorage.setItem('fp.chosen',                       'returnprevious');
    sessionStorage.setItem('fp.route.returnprevious.name',    payload.name);
    sessionStorage.setItem('fp.route.returnprevious.office',  payload.office);
    sessionStorage.setItem('fp.route.returnprevious.officeType', payload.officeType);
    sessionStorage.setItem('fp.remark.returnprevious',        payload.remark);
    clickAddReviewer();
  }};

// ----------------------------------------------------------------

// --- START ---

function getRequestId() {
const allLabels = document.querySelectorAll('p, span, div, td, h1, h2, h3, h4, h5');
for (let el of allLabels) {
const text = el.textContent.trim();
if (/^NOE\d+$/i.test(text)) return text.toUpperCase();
}
const bodyText = document.body.innerText || '';
const match = bodyText.match(/\bNOE\d+\b/i);
return match ? match[0].toUpperCase() : null;
}

const requestId = getRequestId();
if (!requestId || !requestId.startsWith('NOE')) {
console.log('[FCI NOC Assistant] Request ID not found or does not start with NOE ("' + (requestId || 'none') + '"). Extension will NOT activate on this page.');
} else {
console.log('[FCI NOC Assistant] Request ID confirmed: ' + requestId + '. Activating...');
setTimeout(clickViewActionHistory, 2000);
}

})();