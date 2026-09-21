/**
 * HRMS Head-Wise Request Tracker — Apps Script Backend with Auto Column Hiding
 * Sheet ID: 1i577TIu7q44f5WAaEqPu1Ltj_KtHI3IW8nwSGbGIrEs
 */

const SHARED_SECRET = 'HRMS_SECRET_2026_XYZ';
const SPREADSHEET_ID = '1i577TIu7q44f5WAaEqPu1Ltj_KtHI3IW8nwSGbGIrEs';
const CONFIG_TAB_NAME = 'Categories Config';

// Heads to exclude completely from tracking sheets
const EXCLUDED_HEADS = [
  'Passport Letter',
  'Visa Letter',
  'Letter To Leave Country',
  'Letter For Higher Studies',
  'NOC For Other Examination Letter',
  'Identity Certificate for Passport of Dependents Letter',
  'Movable Property Letter',
  'LTC Bharat Darshan/Hometown/Encashment Letter',
  'Briefcase Reimbursement Letter',
  'Mobile Handset/ Telephone Bill/ Data communication Reimbursement Letter',
  'IM-Movable Property Letter',
  'IM-Movable Property Confirmation Letter',
  'SIAS fixation letter',
  'Ltc Encashment (Payments)',
  'Pending Work Distribution',
  'Pending Service Book Audit',
  'Pending Relieving Leave Audit'
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return createJsonResponse({ success: false, error: 'Server busy (lock timeout)' });
  }

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ success: false, error: 'Empty payload received' });
    }

    const payload = JSON.parse(e.postData.contents);

    if (payload.token !== SHARED_SECRET) {
      return createJsonResponse({ success: false, error: 'Unauthorized: Invalid token' });
    }

    const categories = payload.categories || {};
    if (Object.keys(categories).length === 0) {
      return createJsonResponse({ success: false, error: 'Missing categories data' });
    }

    const rawTimestamp = payload.timestamp ? new Date(payload.timestamp) : new Date();

    const targetDateTab = formatDateDDMMYYYY(rawTimestamp);
    const formattedTimeHeader = formatTimeHHMM(rawTimestamp); // e.g., "05:26 PM"

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Sync config and retrieve allowed categories
    const allowedCategories = syncAndGetAllowedCategories(ss, categories);

    if (Object.keys(allowedCategories).length === 0) {
      return createJsonResponse({ success: true, message: 'All scraped categories are excluded.' });
    }

    let sheet = ss.getSheetByName(targetDateTab);

    if (!sheet) {
      sheet = ss.insertSheet(targetDateTab);
      initializeNewDateSheet(sheet, allowedCategories);
    }

    // Clean any previously written excluded rows from existing sheet
    cleanExcludedRowsFromSheet(sheet);

    // Process snapshot
    processSnapshotTransposed(sheet, formattedTimeHeader, allowedCategories);

    return createJsonResponse({ success: true, date: targetDateTab });

  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function formatDateDDMMYYYY(d) {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatTimeHHMM(d) {
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = String(hours).padStart(2, '0');
  
  return `${formattedHours}:${minutes} ${ampm}`;
}

function normalizeStr(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isHeadExcluded(catName) {
  const normCat = normalizeStr(catName);
  return EXCLUDED_HEADS.some(ex => normalizeStr(ex) === normCat);
}

function syncAndGetAllowedCategories(ss, scrapedCategories) {
  let configSheet = ss.getSheetByName(CONFIG_TAB_NAME);
  if (!configSheet) {
    configSheet = ss.insertSheet(CONFIG_TAB_NAME);
    configSheet.getRange(1, 1, 1, 2).setValues([['Category Name', 'Type (daily / exclude)']]).setFontWeight('bold');
    configSheet.setFrozenRows(1);
  }

  const data = configSheet.getDataRange().getValues();
  const configMap = {};

  for (let i = 1; i < data.length; i++) {
    const name = data[i][0];
    const type = String(data[i][1]).toLowerCase().trim();
    if (name) {
      configMap[normalizeStr(name)] = type;
    }
  }

  const newRows = [];
  const allowedCategories = {};

  Object.keys(scrapedCategories).forEach(catName => {
    const normKey = normalizeStr(catName);
    
    if (!(normKey in configMap)) {
      const type = isHeadExcluded(catName) ? 'exclude' : 'daily';
      configMap[normKey] = type;
      newRows.push([catName, type]);
    }

    if (configMap[normKey] === 'daily' && !isHeadExcluded(catName)) {
      allowedCategories[catName] = scrapedCategories[catName];
    }
  });

  if (newRows.length > 0) {
    configSheet.getRange(configSheet.getLastRow() + 1, 1, newRows.length, 2).setValues(newRows);
  }

  return allowedCategories;
}

function cleanExcludedRowsFromSheet(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  for (let i = lastRow; i >= 2; i--) {
    const cellValue = sheet.getRange(i, 1).getValue();
    if (cellValue.toString().toUpperCase() === 'TOTAL') {
      sheet.deleteRow(i);
    } else if (isHeadExcluded(cellValue)) {
      sheet.deleteRow(i);
    }
  }
}

function initializeNewDateSheet(sheet, categories) {
  sheet.getRange(1, 1, 1, 2).setValues([['Category / Time', 'Attended Today']]).setFontWeight('bold').setBackground('#D9E1F2');
  
  const catNames = Object.keys(categories);
  const initialRows = catNames.map(cat => [cat, 0]);

  if (initialRows.length > 0) {
    sheet.getRange(2, 1, initialRows.length, 2).setValues(initialRows);
    sheet.getRange(2, 1, initialRows.length, 1).setFontWeight('bold');
    sheet.getRange(2, 2, initialRows.length, 1).setFontWeight('bold').setBackground('#E8F0FE').setHorizontalAlignment('center');
  }

  sheet.setFrozenColumns(2);
  sheet.setFrozenRows(1);
}

function processSnapshotTransposed(sheet, formattedTime, categories) {
  removeTotalRow(sheet);

  const lastCol = sheet.getLastColumn();
  const nextColIdx = lastCol + 1;
  const isFirstCaptureOfDate = (lastCol === 2);

  const lastRow = sheet.getLastRow();
  let existingCats = [];
  if (lastRow >= 2) {
    existingCats = sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(row => row[0]);
  }

  const incomingCats = Object.keys(categories);
  incomingCats.forEach(cat => {
    if (existingCats.indexOf(cat) === -1 && !isHeadExcluded(cat)) {
      existingCats.push(cat);
      const newRowIdx = existingCats.length + 1;
      sheet.getRange(newRowIdx, 1).setValue(cat).setFontWeight('bold');
      sheet.getRange(newRowIdx, 2).setValue(0).setFontWeight('bold').setBackground('#E8F0FE').setHorizontalAlignment('center');
    }
  });

  // Write time header
  const headerCell = sheet.getRange(1, nextColIdx);
  headerCell.setValue(formattedTime).setFontWeight('bold').setBackground('#D9E1F2').setHorizontalAlignment('center');

  // Write capture counts
  const newColValues = existingCats.map(cat => [categories[cat] !== undefined ? categories[cat] : 0]);
  const dataRange = sheet.getRange(2, nextColIdx, newColValues.length, 1);
  dataRange.setValues(newColValues).setHorizontalAlignment('center');

  // Calculate Attended Today drops if 2nd capture or later
  if (!isFirstCaptureOfDate) {
    const prevColIdx = lastCol;
    const prevColValues = sheet.getRange(2, prevColIdx, existingCats.length, 1).getValues();
    const attendedTotals = sheet.getRange(2, 2, existingCats.length, 1).getValues();

    for (let i = 0; i < existingCats.length; i++) {
      const prevVal = typeof prevColValues[i][0] === 'number' ? prevColValues[i][0] : 0;
      const currentVal = newColValues[i][0];

      const drop = prevVal - currentVal;
      if (drop > 0) {
        attendedTotals[i][0] = (Number(attendedTotals[i][0]) || 0) + drop;
      }
    }

    sheet.getRange(2, 2, attendedTotals.length, 1).setValues(attendedTotals);
  }

  // Append Total row
  appendTotalRow(sheet, existingCats.length, nextColIdx);

  sheet.autoResizeColumn(nextColIdx);

  // Manage Column Visibility: Keep Baseline (Col C) & Latest (Col nextColIdx), hide intermediate columns
  manageColumnVisibility(sheet, nextColIdx);
}

function removeTotalRow(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const lastRowLabel = sheet.getRange(lastRow, 1).getValue();
    if (String(lastRowLabel).toUpperCase() === 'TOTAL') {
      sheet.deleteRow(lastRow);
    }
  }
}

function appendTotalRow(sheet, categoryCount, currentMaxCol) {
  const totalRowIdx = categoryCount + 2;
  
  const labelCell = sheet.getRange(totalRowIdx, 1);
  labelCell.setValue('Total').setFontWeight('bold').setBackground('#D9E1F2');

  for (let col = 2; col <= currentMaxCol; col++) {
    const colLetter = getColumnLetter(col);
    const cell = sheet.getRange(totalRowIdx, col);
    cell.setFormula(`=SUM(${colLetter}2:${colLetter}${totalRowIdx - 1})`)
        .setFontWeight('bold')
        .setBackground(col === 2 ? '#C9DAF8' : '#D9E1F2')
        .setHorizontalAlignment('center');
  }
}

function manageColumnVisibility(sheet, latestColIdx) {
  // If we have more than 3 data/snapshot columns (A=1, B=2, Baseline C=3)
  if (latestColIdx > 4) {
    // 1. Unhide all columns first to avoid stacking issues
    sheet.showColumns(1, latestColIdx);

    // 2. Hide intermediate snapshot columns from D (4) to latestColIdx - 1
    const hideStartCol = 4;
    const hideNumCols = latestColIdx - hideStartCol;
    if (hideNumCols > 0) {
      sheet.hideColumns(hideStartCol, hideNumCols);
    }
  }
}

function getColumnLetter(colIndex) {
  let temp, letter = '';
  while (colIndex > 0) {
    temp = (colIndex - 1) % 26;
    letter = String.fromCharCode(65 + temp) + letter;
    colIndex = (colIndex - temp - 1) / 26;
  }
  return letter;
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}