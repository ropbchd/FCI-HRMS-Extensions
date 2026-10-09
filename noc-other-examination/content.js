// FCI NOC Assistant - Content Script
// Runs on every NOC review page.
// Checks action history and routes to the correct next step.
// v4.8 — Optimized draggable notification panel with refined visual theme.

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

// --- DO-LEVEL CLEARANCE KEYWORD LISTS (Step A) ---
const DO_COMBINED_CLEAR_EN = [
  'free from admin and vigilance',
  'free from administrative and vigilance',
  'free from vigilance and administrative',
  'free from vigilance and admin angle',
  'free from administrative angle and vigilance angle',
  'admin and vigilance angle clear',
  'administrative and vigilance perspective clear',
  'no admin/vigilance case is pending',
  'no admin/vigilance case pending'
];

const DO_COMBINED_CLEAR_HI = [
  'प्रशासनिक एवं सतर्कता दृष्टिकोण से मुक्त',
  'प्रशासनिक एवम सतर्कता दृष्टि से मुक्त',
  'प्रशासनिक और सतर्कता दृष्टिकोण से मुक्त',
  'प्रशासन और सतर्कता दृष्टिकोण से मुक्त है',
  'सतर्कता एवं प्रशासनिक दृष्टिकोण से मुक्त',
  'सतर्कता और प्रशासनिक दृष्टिकोण से मुक्त',
  'प्रशासनिक एवं सतर्कता स्तर पर कोई भी मामला लंबित नहीं',
  'कर्मचारी डीओ स्तर पर प्रशासनिक एवम सतर्कता मामलों से भी मुक्त हैं',
  'सतर्कता एवं प्रशासनिक स्तर पर कोई भी मामला लंबित नहीं'
];

const DO_ADMIN_CLEAR_EN = [
  'free from admin',
  'free from administrative',
  'no admin case pending',
  'no administrative case pending',
  'administrative clearance: clear',
  'admin angle clear',
  'administrative angle clear',
  'clear from administrative',
  'clear from admin',
  'there is no administrative case',
  'no administrative case as per service record',
  'free from any administrative angle',
  'official is free from admin',
  'employee is free from admin'
];

const DO_ADMIN_CLEAR_HI = [
  'प्रशासनिक दृष्टिकोण से मुक्त',
  'प्रशासनिक दृष्टिकोण से भी मुक्त',
  'प्रशासनिक स्तर पर कोई भी मामला लंबित नहीं',
  'शासिनक दृष्टिकोण से मुक्त',
  'कोई विजिलेंस केस लंबित अथवा विचाराधीन नहीं पाया गया है'
  'प्रशासनिक दृष्टिकोण से मुक्त है'
];

const DO_VIGILANCE_CLEAR_EN = [
  'free from vigilance',
  'no vigilance case pending',
  'vigilance clearance: clear',
  'vigilance angle clear',
  'clear from vigilance',
  'no vigilance case/cbi/acb/ed/fir case pending',
  'no vigilance case pending and no acb/ed/cbi/fir case',
  'vigilance status is clear',
  'no case of cbi/acb/ed/fir',
  'no vigilance case/cbi/acb/ed/fir',
  'there is no vigilance case pending',
  'official is free from vigilance',
  'employee is free from vigilance'
];

const DO_VIGILANCE_CLEAR_HI = [
  'सतर्कता दृष्टिकोण से मुक्त',
  'सतर्कता दृष्टिकोण से भी मुक्त',
  'सतर्कता स्तर पर कोई भी मामला लंबित नहीं',
  'सतर्कता दृष्टिकोण से मुक्त है',
  'कोई विजिलेंस केस लंबित नहीं',
  'कोई सतर्कता मामला लंबित नहीं'
];

function normalizeForMatching(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

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

const OFFICE_TYPE_RO = '4';
const OFFICE_TYPE_DO = '5';
const RO_CHANDIGARH = 'RO CHANDIGARH';
const PERFORMA_CHECKPOINT = 'performa provided by the FCI';

const BALJIT_CLEAR_HINDI_RAW = 'सतर्कता दृष्टिकोण से मुक्त है';
const BALJIT_CLEAR_HINDI = BALJIT_CLEAR_HINDI_RAW.replace(/\s+/g, '');
const BALJIT_CLEAR_KEYWORDS = ['सतर्कता', 'मुक्त'];
const VIGILANCE_AUTHORITY_NAMES = ['BALJIT SINGH', 'BHARATI SAINI'];

function isVigilanceAuthorityName(employeeName) {
  if (!employeeName) return false;
  const upper = employeeName.toUpperCase();
  return VIGILANCE_AUTHORITY_NAMES.some(function(n) { return upper.includes(n); });
}

const MISMATCH_REMARK_NOT_CLEAR = 'Kindly re-examine the request. As per vigilance records, the concerned employee is not vigilance free.';

let _fciWorkflowCache = {
  requestId: null,
  entries: null,
  cadreValue: null,
  officeValue: null,
  isRoChandigarh: null,
  hasRecommendation: false,
  recommendedSummary: null,
  payloadRecommended: null,
  payloadReexamine: null,
  payloadReturnPrevious: null
};

function writeFpPayload(key, data) {
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

function isBaljitClear(remark) {
  if (!remark) return false;
  const normalizedRemark = remark.replace(/\s+/g, '');
  if (normalizedRemark.includes(BALJIT_CLEAR_HINDI)) return true;
  return BALJIT_CLEAR_KEYWORDS.every(function(kw) {
    return normalizedRemark.includes(kw);
  });
}

// ===== A. Vigilance classification (para 6(a) vs 6(b)) =====
// FIX: Hard 6(a) bars take precedence over contemplation. 
// Pre-charge-sheet contemplation takes precedence over generic non-clear phrases.
const VIG_6A_HARD    = ['CHARGE SHEET', 'CHARGESHEET', 'PENALTY', 'SUSPEN', 'PROSECUTION SANCTION'];
const VIG_6B         = ['CONTEMPLATION'];
const VIG_6A_GENERIC = ['PENDING', 'INVOLVED', 'DISCIPLINARY PROCEEDINGS', 'NOT CLEAR', 'NOT FREE', 'VIGILANCE CASE'];

function normalizeVigRemark(remark) {
  return (remark || '').toUpperCase().replace(/[-‐-―]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Returns 'bar6a' | 'forward6b' | 'none'
function classifyVigilanceRemark(remark) {
  const t = normalizeVigRemark(remark);
  if (!t) return 'none';
  // 1. Hard 6(a) bars take priority (explicit chargesheet issued, suspension, penalty)
  if (VIG_6A_HARD.some(function (k) { return t.includes(k); }))    return 'bar6a';
  // 2. Pre-chargesheet contemplation falls under 6(b)
  if (VIG_6B.some(function (k) { return t.includes(k); }))         return 'forward6b';
  // 3. Generic non-clear terms without contemplation wording fall under 6(a)
  if (VIG_6A_GENERIC.some(function (k) { return t.includes(k); }))return 'bar6a';
  return 'none';
}

function isBaljitNotClear(remark) {
  if (!remark) return false;
  return classifyVigilanceRemark(remark) === 'bar6a';
}
function isBaljitContemplation(remark) {
  if (!remark) return false;
  return classifyVigilanceRemark(remark) === 'forward6b';
}
function getBaljitStatus(remark) {
  if (!remark) return 'missing';
  if (isBaljitClear(remark)) return 'clear';
  const c = classifyVigilanceRemark(remark);
  if (c === 'bar6a')     return 'notclear';
  if (c === 'forward6b') return 'contemplation';
  return 'ambiguous';
}

function toTitleCase(text) {
  if (!text) return '';
  const ROMAN = /^(I|II|III|IV|V|VI|VII|VIII|IX|X)$/;
  return text.replace(/[A-Za-z]+/g, function (word) {
    if (word !== word.toUpperCase()) return word;
    if (ROMAN.test(word)) return word;
    return word.charAt(0) + word.slice(1).toLowerCase();
  });
}

function buildVigilanceRemarkContext() {
  const examRaw  = getFieldValue('examination_name');
  const nocCount = parseInt(getFieldValue('nNOCApproved') || '0', 10) || 0;
  let who = toTitleCase(getFieldValue('employee_name')) || 'The official';
  const designation = toTitleCase(getFieldValue('designation'));
  const cadre       = toTitleCase(getFieldValue('cadre'));
  if (designation) who += ', ' + designation;
  if (cadre)       who += ' (' + cadre + ')';
  who += ',';
  return {
    who: who,
    examPhrase: examRaw ? 'the ' + examRaw : 'the examination',
    ordinal: getOrdinal(nocCount + 1)
  };
}

const VIG_REMARK_DO_RO_CLEAR_SENTENCE = 'While the official is clear from the administrative and vigilance angles at DO level and administrative angle at RO level';

function build6aRemark(ctx, vigSlNo) {
  return ctx.who + ' has requested issuance of an NOC to appear in ' + ctx.examPhrase + '. ' +
    'This is the ' + ctx.ordinal + ' NOC request of the official for the current calendar year. ' +
    VIG_REMARK_DO_RO_CLEAR_SENTENCE + ', the official is not clear from the vigilance angle at RO level. ' +
    'As provided by Vigilance Division, RO (Pb), at Sl. No. ' + vigSlNo + ', a vigilance case is pending against the official. ' +
    'In terms of para 6(a) of FCI HQ Circular No. 01-2019-05 dated 17.01.2019 read with DoPT O.M. dated 23.12.2013, the application of an official against whom such a case is pending should not be considered/forwarded. ' +
    'In view of the above, the present request for issuance of NOC for appearing in ' + ctx.examPhrase + ' may be <b>rejected/reverted</b> in accordance with the said circular, for kind consideration and further necessary directions please.';
}

function build6bRemark(ctx, vigSlNo) {
  return ctx.who + ' has requested issuance of an NOC to appear in ' + ctx.examPhrase + '. ' +
    'This is the ' + ctx.ordinal + ' NOC request of the official for the current calendar year. ' +
    VIG_REMARK_DO_RO_CLEAR_SENTENCE + ', as provided by Vigilance Division, RO (Pb), at Sl. No. ' + vigSlNo + ', a vigilance case against the official is under contemplation. ' +
    'In terms of para 6(b) of FCI HQ Circular No. 01-2019-05 dated 17.01.2019 (O.M. No. 14017/101/91-Estt.(RR) dated 14.07.1993), the application of the official may be forwarded, subject to the condition that, in the event of actual selection, the official shall not be released for taking up the appointment if, by that time, any of the situations covered under para 6(a) of the said circular arises. ' +
    'In view of the above, as no charge-sheet has been issued so far, the case of the official falls within the ambit of para 6(b) of the said circular and, if agreed, the request may be forwarded to the competent authority for a decision regarding the approval of the request, subject to the said condition. ' +
    'Submitted for perusal and further directions please.';
}

function isPostPerforma(entries, assistantIndex) {
  if (assistantIndex <= 0) return false;
  const prevEntry = entries[assistantIndex - 1];
  return prevEntry
  && prevEntry.employeeName.toUpperCase().includes('AMIT KUMAR SINGH')
  && prevEntry.actionTaken === 'New Reviewer Added'
  && prevEntry.remark.toLowerCase().includes(PERFORMA_CHECKPOINT.toLowerCase());
}

function getLastBaljitEntry(entries) {
  let lastBaljitIndex = -1;
  for (let i = 0; i < entries.length; i++) {
    if (isVigilanceAuthorityName(entries[i].employeeName)) {
      lastBaljitIndex = i;
    }
  }
  return lastBaljitIndex !== -1 ? entries[lastBaljitIndex] : null;
}

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

function parseDateFromString(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
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

function makeDraggable(element, handle) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  handle.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
    element.style.right = "auto";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

function showUnifiedCompliancePanel(dateStatus, doStatus) {
  const existing = document.getElementById('fci-noc-compliance-panel');
  if (existing) existing.remove();

  const headerBg   = '#029456';
  const titleColor = '#FFFFFF';
  const okGreen    = '#059669';
  const warnAmber  = '#D97706';
  const textColor  = '#064E3B';
  const pillBg     = '#ECFDF5';
  const pillBorder = '#A7F3D0';

  let hasWarning = false;
  let title = '\u2713 Pre-Approval Compliance';

  let dateHtml = '';
  if (dateStatus && dateStatus.hrmsDate && dateStatus.formDate) {
    const isMismatch = dateStatus.type === 'mismatch';
    const isSevere   = isMismatch && dateStatus.dayDiff > 7;
    const icon = isMismatch ? (isSevere ? '\u26A0\uFE0F' : '\u2139\uFE0F') : '\u2713';
    const msg = isMismatch
      ? (isSevere
          ? 'HRMS initiation is <b>' + dateStatus.dayDiff + ' days</b> after form filling. Exceeds limit.'
          : 'HRMS initiation is <b>' + dateStatus.dayDiff + ' day(s)</b> after form filling. Within window.')
      : 'HRMS date is <b>' + (dateStatus.dayDiff === 0 ? 'same day as' : dateStatus.dayDiff + ' day(s) prior to') + '</b> form date.';
    if (isSevere) hasWarning = true;

    dateHtml =
      '<div style="margin-bottom:14px; border-bottom:1px solid #f0f0f0; padding-bottom:10px;">' +
        '<div style="font-weight:600; color:' + textColor + '; margin-bottom:6px; font-size:13px;">' + icon + ' Date Compliance</div>' +
        '<div style="color:#333; font-size:12px; margin-bottom:6px;">' + msg + '</div>' +
        '<div style="background:' + pillBg + '; border:1px solid ' + pillBorder + '; padding:8px 10px; border-radius:4px; font-size:11px; color:' + textColor + ';">' +
          '<b>HRMS:</b> ' + formatDate(dateStatus.hrmsDate) + ' &nbsp;|&nbsp; <b>Form:</b> ' + formatDate(dateStatus.formDate) + ' &nbsp;|&nbsp; <b>Gap:</b> ' + dateStatus.dayDiff + ' day(s)' +
        '</div>' +
      '</div>';
  } else if (dateStatus) {
    dateHtml =
      '<div style="margin-bottom:14px; border-bottom:1px solid #f0f0f0; padding-bottom:10px;">' +
        '<div style="font-weight:600; color:' + textColor + '; margin-bottom:6px; font-size:13px;">\u2139\uFE0F Date Compliance</div>' +
        '<div style="color:#666; font-size:12px;">Date check skipped: Could not extract HRMS or form date.</div>' +
      '</div>';
  }

  let doHtml = '';
  if (doStatus) {
    if (doStatus.error) {
      hasWarning = true;
      doHtml =
        '<div style="margin-bottom:14px; border-bottom:1px solid #f0f0f0; padding-bottom:10px;">' +
          '<div style="font-weight:600; color:' + warnAmber + '; margin-bottom:6px; font-size:13px;">\u26A0\uFE0F DO-Level Clearance</div>' +
          '<div style="color:#666; font-size:12px;">' + doStatus.error + '</div>' +
        '</div>';
    } else {
      const adminOk = doStatus.adminClear;
      const vigOk   = doStatus.vigilanceClear;
      if (!adminOk || !vigOk) hasWarning = true;

      const adminIcon  = adminOk ? '\u2713' : '\u26A0\uFE0F';
      const adminColor = adminOk ? okGreen : warnAmber;
      const adminMsg   = adminOk
        ? 'Confirmed at <b>S.No. ' + doStatus.adminSlNo + '</b>'
        : 'Not explicitly confirmed in any DO-level remark.';

      const vigIcon  = vigOk ? '\u2713' : '\u26A0\uFE0F';
      const vigColor = vigOk ? okGreen : warnAmber;
      const vigMsg   = vigOk
        ? 'Confirmed at <b>S.No. ' + doStatus.vigilanceSlNo + '</b>'
        : 'Not explicitly confirmed in any DO-level remark.';

      doHtml =
        '<div style="margin-bottom:14px; border-bottom:1px solid #f0f0f0; padding-bottom:10px;">' +
          '<div style="font-weight:600; color:' + textColor + '; margin-bottom:8px; font-size:13px;">\uD83C\uDFE2 DO-Level Clearance</div>' +
          '<div style="margin-bottom:6px; font-size:12px; color:' + adminColor + ';">' + adminIcon + ' <b>Admin:</b> ' + adminMsg + '</div>' +
          '<div style="font-size:12px; color:' + vigColor + ';">' + vigIcon + ' <b>Vigilance:</b> ' + vigMsg + '</div>' +
        '</div>';
    }
  }

  if (hasWarning) title = '\u2139\uFE0F Review Required Before Submit';

  const panel = document.createElement('div');
  panel.id = 'fci-noc-compliance-panel';
  panel.style.cssText =
    'position:fixed;top:80px;right:20px;z-index:2147483647;width:360px;' +
    'background:#ffffff;border-radius:10px;font-family:Arial,sans-serif;' +
    'font-size:13px;line-height:1.5;box-shadow:0 8px 32px rgba(0,0,0,0.2);' +
    'overflow:hidden;box-sizing:border-box;transition:opacity 0.3s ease;' +
    'border-left:5px solid ' + (hasWarning ? warnAmber : okGreen) + ';' +
    'border-top:1px solid #d0d0d0;border-right:1px solid #d0d0d0;border-bottom:1px solid #d0d0d0;';

  panel.innerHTML =
    '<div id="fci-noc-drag-header" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:' + headerBg + ';cursor:move;user-select:none;">' +
      '<strong style="font-size:13px;color:' + titleColor + ';margin:0;">' + title + '</strong>' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
        '<span style="color:rgba(255,255,255,0.7);font-size:14px;cursor:move;" title="Drag panel">\u22EE\u22EE</span>' +
        '<button id="fci-noc-close-panel" style="background:none;border:none;font-size:18px;cursor:pointer;line-height:1;color:' + titleColor + ';opacity:0.8;padding:0;">&times;</button>' +
      '</div>' +
    '</div>' +
    '<div style="padding:14px;">' +
      dateHtml +
      doHtml +
      '<div style="font-size:11px;color:#888;border-top:1px solid #f0f0f0;padding-top:8px;">' +
        'Non-blocking notice. Extension proceeds with approval remark. Please review before clicking Submit.' +
      '</div>' +
    '</div>';

  document.body.appendChild(panel);

  const dragHeader = document.getElementById('fci-noc-drag-header');
  makeDraggable(panel, dragHeader);

  document.getElementById('fci-noc-close-panel').addEventListener('click', function() {
    panel.style.opacity = '0';
    setTimeout(function() { panel.remove(); }, 300);
  });

  setTimeout(function() {
    if (document.getElementById('fci-noc-compliance-panel')) {
      panel.style.opacity = '0';
      setTimeout(function() { panel.remove(); }, 300);
    }
  }, 30000);
}

function runPreApprovalChecks(entries, isRoChandigarh, lastAssistantReviewed) {
  const hrmsDate = getHrmsInitiationDate(entries);
  const formDate = extractFormFillingDate(lastAssistantReviewed ? lastAssistantReviewed.remark : '');
  let dateStatus = null;
  if (hrmsDate && formDate) {
    const oneDay = 24 * 60 * 60 * 1000;
    if (hrmsDate > formDate) {
      const dayDiff = Math.round((hrmsDate - formDate) / oneDay);
      dateStatus = { hrmsDate, formDate, dayDiff, type: 'mismatch' };
      console.warn('[FCI NOC Assistant] \u26A0\uFE0F DATE MISMATCH: HRMS (' + formatDate(hrmsDate) + ') is ' + dayDiff + ' day(s) AFTER form date (' + formatDate(formDate) + ').');
    } else {
      const dayDiff = Math.round((formDate - hrmsDate) / oneDay);
      dateStatus = { hrmsDate, formDate, dayDiff, type: 'compliant' };
      console.log('[FCI NOC Assistant] Date check confirmed: HRMS date (' + formatDate(hrmsDate) + ') is on or before Form date (' + formatDate(formDate) + ').');
    }
  } else {
    console.log('[FCI NOC Assistant] Date check skipped: Could not extract HRMS date or form date from remark.');
  }

  let doStatus = null;
  if (!isRoChandigarh) {
    doStatus = getDoLevelClearanceStatus(entries);
    if (doStatus.error) {
      console.warn('[FCI NOC Assistant] DO-level check: ' + doStatus.error);
    } else {
      console.log('[FCI NOC Assistant] DO Admin clear: ' + (doStatus.adminClear ? 'YES (S.No. ' + doStatus.adminSlNo + ')' : 'NO'));
      console.log('[FCI NOC Assistant] DO Vigilance clear: ' + (doStatus.vigilanceClear ? 'YES (S.No. ' + doStatus.vigilanceSlNo + ')' : 'NO'));
    }
  } else {
    console.log('[FCI NOC Assistant] DO-level check skipped: RO Chandigarh file.');
  }

  showUnifiedCompliancePanel(dateStatus, doStatus);
}

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

function getDoManagerEntryWithIndex(entries) {
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].designation.trim() === AGM_DESIGNATION
        && entries[i].remark.trim() !== 'N/A'
        && entries[i].remark.trim() !== '') {
      if (i > 0) {
        return {
          managerEntry: entries[i - 1],
          agmIndex: i
        };
      }
    }
  }
  return null;
}

function checkDoClearance(remark) {
  const normEn = normalizeForMatching(remark).toLowerCase();
  const normHi = normalizeForMatching(remark);
  let admin = false;
  let vigilance = false;
  for (const p of DO_COMBINED_CLEAR_EN) {
    if (normEn.includes(p.toLowerCase())) { admin = true; vigilance = true; break; }
  }
  if (!admin || !vigilance) {
    for (const p of DO_COMBINED_CLEAR_HI) {
      if (normHi.includes(p)) { admin = true; vigilance = true; break; }
    }
  }
  if (!admin) {
    for (const p of DO_ADMIN_CLEAR_EN) {
      if (normEn.includes(p.toLowerCase())) { admin = true; break; }
    }
  }
  if (!admin) {
    for (const p of DO_ADMIN_CLEAR_HI) {
      if (normHi.includes(p)) { admin = true; break; }
    }
  }
  if (!vigilance) {
    for (const p of DO_VIGILANCE_CLEAR_EN) {
      if (normEn.includes(p.toLowerCase())) { vigilance = true; break; }
    }
  }
  if (!vigilance) {
    for (const p of DO_VIGILANCE_CLEAR_HI) {
      if (normHi.includes(p)) { vigilance = true; break; }
    }
  }
  return { admin, vigilance };
}

function getDoLevelClearanceStatus(entries) {
  const landmark = getDoManagerEntryWithIndex(entries);
  if (!landmark || !landmark.managerEntry) {
    return {
      adminClear: false,
      adminSlNo: null,
      vigilanceClear: false,
      vigilanceSlNo: null,
      error: 'DO Manager (Admin.) could not be identified \u2014 AGM landmark not found.'
    };
  }
  const agmIndex = landmark.agmIndex;
  let adminClear = false;
  let adminSlNo = null;
  let vigilanceClear = false;
  let vigilanceSlNo = null;

  const mgrResult = checkDoClearance(landmark.managerEntry.remark);
  if (mgrResult.admin) {
    adminClear = true;
    adminSlNo = landmark.managerEntry.slNo;
  }
  if (mgrResult.vigilance) {
    vigilanceClear = true;
    vigilanceSlNo = landmark.managerEntry.slNo;
  }

  for (let i = agmIndex - 2; i >= 0; i--) {
    const entry = entries[i];
    if (entry.actionTaken === 'Initiated') continue;
    if (entry.designation.trim() === AGM_DESIGNATION) continue;

    const result = checkDoClearance(entry.remark);
    if (!adminClear && result.admin) {
      adminClear = true;
      adminSlNo = entry.slNo;
    }
    if (!vigilanceClear && result.vigilance) {
      vigilanceClear = true;
      vigilanceSlNo = entry.slNo;
    }
    if (adminClear && vigilanceClear) break;
  }
  return {
    adminClear,
    adminSlNo,
    vigilanceClear,
    vigilanceSlNo,
    error: null
  };
}

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

function parsePageEntries(tbody) {
  const allRows = tbody.querySelectorAll('tr');
  const pageEntries = [];
  let currentEntry = null;
  const MIN_DATA_COLUMNS = 6;

  for (let row of allRows) {
    const cells = row.querySelectorAll('td');
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
      const fullText = cells[0].textContent.trim();
      if (fullText.startsWith('REMARKS:') && currentEntry) {
        currentEntry.remark = fullText.replace('REMARKS:', '').trim();
      }
    }
  }
  return pageEntries;
}

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

function isAbhimanyuInHistory(entries) {
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].actionTaken === 'Reviewed'
    && entries[i].employeeName.toUpperCase().includes('ABHIMANYU SWAMI')) {
      return true;
    }
  }
  return false;
}

function getCadreAndOffice() {
  const cadreValue = getFieldValue('cadre');
  const officeValue = getFieldValue('office');
  const isRoChandigarh = officeValue.trim().replace(/\s+/g, ' ').toUpperCase() === 'RO CHANDIGARH';
  return { cadreValue, officeValue, isRoChandigarh };
}

function highlightMismatch(tbody, baljitEntry, assistantEntry) {
  const allRows = tbody.querySelectorAll('tr');

  if (baljitEntry) {  
    for (let row of allRows) {  
      const cells = row.querySelectorAll('td');  
      if (cells.length === 8) {  
        const name = cells[4].textContent.trim().toUpperCase().replace(/\s+/g, ' ');  
        const action = cells[3].textContent.trim();  
        if (isVigilanceAuthorityName(name) && action === 'Reviewed') {  
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

function checkConditionsAndAct(entries, tbody) {
  _fciWorkflowCache.entries        = entries;
  _fciWorkflowCache.cadreValue     = getCadreAndOffice().cadreValue;
  _fciWorkflowCache.officeValue    = getCadreAndOffice().officeValue;
  _fciWorkflowCache.isRoChandigarh = getCadreAndOffice().isRoChandigarh;
  _fciWorkflowCache.requestId      = getRequestId();

  const { cadreValue, officeValue, isRoChandigarh } = getCadreAndOffice();
  console.log('[FCI NOC Assistant] Office read from page: "' + officeValue + '"');
  console.log('[FCI NOC Assistant] Cadre read from page:  "' + cadreValue + '"');
  console.log('[FCI NOC Assistant] isRoChandigarh: ' + isRoChandigarh);

  const doManagerEntry = getDoManagerEntry(entries);  

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

  const stage3KeyPresent = lastAssistantReviewed && (function() {  
    const normalizedRemark = lastAssistantReviewed.remark.toLowerCase().replace(/\s+/g, ' ');  
    const idx = normalizedRemark.indexOf(STAGE3_KEY_SENTENCE);  
    if (idx === -1) return false;  
    const preceding = normalizedRemark.substring(Math.max(0, idx - 25), idx);  
    return !(/\bnot\b/.test(preceding));  
  })();  

  const lastBaljit = getLastBaljitEntry(entries);  
  const baljitRemark = lastBaljit ? lastBaljit.remark : '';  
  const baljitStatus = getBaljitStatus(baljitRemark);  
  const baljitClear         = (baljitStatus === 'clear');  
  const baljitNotClear      = (baljitStatus === 'notclear');  
  const baljitContemplation = (baljitStatus === 'contemplation');
  const baljitAmbiguous     = (baljitStatus === 'ambiguous');  

  console.log('[FCI NOC Assistant] BALJIT status: ' + baljitStatus);  
  console.log('[FCI NOC Assistant] BALJIT remark: "' + baljitRemark + '"');  

  const baseConditions = lastAssistantReviewed  
    && afterAssistantReviewed  
    && afterAssistantReviewed.employeeName.toUpperCase().includes(STAGE2_NEXT_NAME)  
    && afterAssistantReviewed.actionTaken.trim() === STAGE2_NEXT_ACTION  
    && afterAssistantReviewed.remark.trim() === STAGE2_NEXT_REMARK;  

  const isPostPerformaFlag = isPostPerforma(entries, lastAssistantReviewedIndex);  

  // --- Sync Gate Matrix ---  
  const stage3e = baseConditions && baljitNotClear && !stage3KeyPresent;  
  const stage3  = baseConditions && baljitClear && stage3KeyPresent;  
  const stage3f = baseConditions && baljitContemplation && stage3KeyPresent;

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

  const mismatchNotClear = baseConditions && baljitNotClear && stage3KeyPresent;  
  const mismatchAmbiguous = baseConditions && baljitAmbiguous;  

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
    && !stage3f
    && !stage3bAssistantIssue;

  const stage1c = lastAssistantReviewed  
    && isPostPerformaFlag  
    && !abhimanyuPresent  
    && isRoChandigarh  
    && afterAssistantReviewed  
    && afterAssistantReviewed.employeeName.toUpperCase().includes(STAGE2_NEXT_NAME)  
    && afterAssistantReviewed.actionTaken.trim() === STAGE2_NEXT_ACTION  
    && afterAssistantReviewed.remark.trim() === STAGE2_NEXT_REMARK;  

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
    sessionStorage.setItem('fp.route.returnprevious.office', p.office);
    sessionStorage.setItem('fp.route.returnprevious.officeType', p.officeType);
    sessionStorage.setItem('fp.remark.returnprevious', p.remark);
  }

  console.log('[FCI NOC Assistant] Stage 3  (Fill Approval Remark):                  ' + (stage3  ? 'MATCH' : 'no match'));  
  console.log('[FCI NOC Assistant] Stage 3E (Fill Rejection Remark):                 ' + (stage3e ? 'MATCH' : 'no match'));  
  console.log('[FCI NOC Assistant] Stage 3F (Fill 6(b) Forwarding Remark):          ' + (stage3f ? 'MATCH' : 'no match'));
  console.log('[FCI NOC Assistant] MISMATCH (BALJIT Clear + Assistant NOT in order): ' + (mismatchClear    ? '⚠️ MISMATCH' : 'no match'));  
  console.log('[FCI NOC Assistant] MISMATCH (BALJIT Not Clear + Assistant in order): ' + (mismatchNotClear ? '⚠️ MISMATCH' : 'no match'));  
  console.log('[FCI NOC Assistant] MISMATCH (BALJIT Ambiguous):                      ' + (mismatchAmbiguous ? '⚠️ MISMATCH' : 'no match'));  
  console.log('[FCI NOC Assistant] Stage 3B (Send back to DO Manager):               ' + (stage3b ? 'MATCH' : 'no match'));  
  console.log('[FCI NOC Assistant] Stage 3D (Send back to Initiating Official - RO): ' + (stage3d ? 'MATCH' : 'no match'));  
  console.log('[FCI NOC Assistant] Stage 3C (Re-send to assistant):                  ' + (stage3c ? 'MATCH' : 'no match'));  
  console.log('[FCI NOC Assistant] Stage 2  (Send to Assistant):                     ' + (stage2  ? 'MATCH' : 'no match'));  
  console.log('[FCI NOC Assistant] Stage 1C (Send to ABHIMANYU after performa):      ' + (stage1c ? 'MATCH' : 'no match'));  
  console.log('[FCI NOC Assistant] Stage 1  (Send to ABHIMANYU SWAMI):               ' + (stage1  ? 'MATCH' : 'no match'));  

  if (doManagerEntry) {  
    console.log('[FCI NOC Assistant] DO Manager identified: "' + doManagerEntry.employeeName + '" (S.No. ' + doManagerEntry.slNo + ')');  
  }  

  // --- Priority Order: 3E → 3 → 3F → MISMATCH → 3B → 3D → 3C → 2 → 1C → 1B → 1 ---  

  if (stage3e) {  
    const assistantName = lastAssistantReviewed ? lastAssistantReviewed.employeeName : 'Assistant';  
    console.log('[FCI NOC Assistant] Stage 3E: Filling rejection proposal remark...');
    _fciWorkflowCache.hasRecommendation = true;
    _fciWorkflowCache.recommendedSummary = 'Stage 3E — Filling rejection proposal remark (vigilance case pending)';
    highlightTriggerRow(tbody, assistantName, 'Reviewed');  

    const ctx = buildVigilanceRemarkContext();
    const stage3eRemark = build6aRemark(ctx, lastBaljit.slNo);
    setTimeout(function() { fillReviewerRemarks(stage3eRemark, true); }, 2000);  

  } else if (stage3) {
    const assistantName = lastAssistantReviewed ? lastAssistantReviewed.employeeName : 'Assistant';
    console.log('[FCI NOC Assistant] Stage 3: Filling approval remark...');
    _fciWorkflowCache.hasRecommendation = true;
    _fciWorkflowCache.recommendedSummary = 'Stage 3 \u2014 Filling approval remark (request is in order)';
    
    runPreApprovalChecks(entries, isRoChandigarh, lastAssistantReviewed);

    highlightTriggerRow(tbody, assistantName, 'Reviewed');  
    const remarkToFill = isRoChandigarh ? STAGE3_REMARK_RO : STAGE3_REMARK_NON_RO;  
    setTimeout(function() { fillReviewerRemarks(remarkToFill, false); }, 2000);

  } else if (stage3f) {
    const assistantName = lastAssistantReviewed ? lastAssistantReviewed.employeeName : 'Assistant';
    console.log('[FCI NOC Assistant] Stage 3F: Filling para 6(b) forwarding remark (vigilance case under contemplation)...');
    _fciWorkflowCache.hasRecommendation = true;
    _fciWorkflowCache.recommendedSummary = 'Stage 3F — Filling para 6(b) forwarding remark (vigilance case under contemplation)';

    runPreApprovalChecks(entries, isRoChandigarh, lastAssistantReviewed);

    highlightTriggerRow(tbody, assistantName, 'Reviewed');
    const ctx = buildVigilanceRemarkContext();
    const remark6b = build6bRemark(ctx, lastBaljit.slNo);
    setTimeout(function() { fillReviewerRemarks(remark6b, false); }, 2000);

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

  if (window.FloatingWindow && typeof window.FloatingWindow.render === 'function') {
    window.FloatingWindow.render();
  } else {
    console.log('[FCI NOC Assistant] Floating window not available.');
  }
}

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

function loadFramework() {
  return new Promise((resolve) => {
    console.log('[FCI NOC Assistant] Floating window framework registered statically via manifest');
    resolve();
  });
}

function initLearningLayer() {
  console.log('[FCI NOC Assistant] Learning layer available via framework');
}

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
  }
};

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

async function start() {
  const requestId = getRequestId();
  if (!requestId || !requestId.startsWith('NOE')) {
    console.log('[FCI NOC Assistant] Request ID not found or does not start with NOE ("' + (requestId || 'none') + '"). Extension will NOT activate on this page.');
    return;
  }

  console.log('[FCI NOC Assistant] Request ID confirmed: ' + requestId + '. Activating...');

  await loadFramework();
  initLearningLayer();

  setTimeout(clickViewActionHistory, 2000);
}

start();

})();