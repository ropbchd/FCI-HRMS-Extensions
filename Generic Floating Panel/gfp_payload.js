// ============================================================================
// COMMON FCI HRMS ROUTING RULES — DIAGNOSTIC VERSION
// ============================================================================

const GFPPayload = {
  _cache: {
    reexamine: null,
    returnprevious: null
  },

  getFieldValue: (fieldName) => {
    const listItems = document.querySelectorAll('li');
    for (let li of listItems) {
      const label = li.querySelector('label');
      const span = li.querySelector('span');
      if (label && span && label.getAttribute('for') === fieldName) {
        return span.textContent.trim();
      }
    }
    GFPLogger.warn(`getFieldValue: Could not find field "${fieldName}" on page.`);
    return '';
  },

  parsePageEntries: (tbody) => {
    const entries = [];
    const allRows = tbody.querySelectorAll('tr');
    let currentEntry = null;
    
    GFPLogger.info(`parsePageEntries: Found ${allRows.length} rows in tbody.`);
    
    for (let row of allRows) {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 6) {
        currentEntry = {
          slNo: cells[0] ? cells[0].textContent.trim() : '',
          dateOfAction: cells[1] ? cells[1].textContent.trim() : '',
          actionTaken: cells[3] ? cells[3].textContent.trim() : '',
          employeeName: cells[4] ? cells[4].textContent.trim() : '',
          designation: cells[5] ? cells[5].textContent.trim() : '',
          employeeNumber: (cells[4] && cells[4].textContent.match(/\d{6}/)) ? cells[4].textContent.match(/\d{6}/)[0] : '',
          remark: ''
        };
        entries.push(currentEntry);
      } else if (cells.length >= 1 && currentEntry) {
        const fullText = cells[0].textContent.trim();
        if (fullText.startsWith('REMARKS:')) {
          currentEntry.remark = fullText.replace('REMARKS:', '').trim();
        }
      }
    }
    
    GFPLogger.info(`parsePageEntries: Parsed ${entries.length} entries.`);
    if (entries.length > 0) {
      GFPLogger.info(`parsePageEntries: First entry: S.No=${entries[0].slNo}, Action="${entries[0].actionTaken}", Name="${entries[0].employeeName}"`);
      GFPLogger.info(`parsePageEntries: Last entry: S.No=${entries[entries.length-1].slNo}, Action="${entries[entries.length-1].actionTaken}", Name="${entries[entries.length-1].employeeName}"`);
    }
    
    return entries;
  },

  getTotalPages: () => {
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
  },

  clickPageNumber: (targetPage) => {
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
          link.click();
          return true;
        }
        return true;
      }
    }
    return false;
  },

  collectAllEntries: (callback) => {
    const totalPages = GFPPayload.getTotalPages();
    GFPLogger.info('Total action history pages: ' + totalPages);
    
    if (totalPages <= 1) {
      const tbody = document.querySelector('#custom-action-history-tbl tbody');
      const entries = tbody ? GFPPayload.parsePageEntries(tbody) : [];
      const seen = new Set();
      const dedupedEntries = entries.filter(e => !seen.has(e.slNo) && seen.add(e.slNo));
      callback(dedupedEntries);
      return;
    }

    let allEntries = [];
    let currentPage = 1;
    const initialTbody = document.querySelector('#custom-action-history-tbl tbody');
    if (initialTbody) {
      allEntries = allEntries.concat(GFPPayload.parsePageEntries(initialTbody));
    }

    const getCurrentFirstSlNo = () => {
      const tbody = document.querySelector('#custom-action-history-tbl tbody');
      if (!tbody) return null;
      const firstRow = tbody.querySelector('tr');
      if (!firstRow) return null;
      const cells = firstRow.querySelectorAll('td');
      if (cells.length >= 1) {
        const slNoText = cells[0].textContent.trim();
        const parsed = parseInt(slNoText);
        return isNaN(parsed) ? null : parsed;
      }
      return null;
    };

    function collectNextPage() {
      currentPage++;
      if (currentPage > totalPages) {
        const seen = new Set();
        allEntries = allEntries.filter(e => !seen.has(e.slNo) && seen.add(e.slNo));
        callback(allEntries);
        return;
      }
      
      const previousFirstSlNo = getCurrentFirstSlNo();
      GFPLogger.info('Pagination: Captured previous first S.No: ' + previousFirstSlNo + '. Clicking page ' + currentPage);

      const clicked = GFPPayload.clickPageNumber(currentPage);
      if (!clicked) {
        GFPLogger.warn('Could not click page ' + currentPage + '. Aborting pagination.');
        const seen = new Set();
        allEntries = allEntries.filter(e => !seen.has(e.slNo) && seen.add(e.slNo));
        callback(allEntries);
        return;
      }

      let attempts = 0;
      const waitInterval = setInterval(() => {
        attempts++;
        const currentFirstSlNo = getCurrentFirstSlNo();
        
        if (currentFirstSlNo !== null && currentFirstSlNo !== previousFirstSlNo) {
          clearInterval(waitInterval);
          const tbody = document.querySelector('#custom-action-history-tbl tbody');
          if (tbody) {
            allEntries = allEntries.concat(GFPPayload.parsePageEntries(tbody));
            GFPLogger.info('Page ' + currentPage + ' collected. New first S.No: ' + currentFirstSlNo);
          }
          setTimeout(collectNextPage, 500);
          return;
        }
        
        if (attempts >= 30) {
          clearInterval(waitInterval);
          GFPLogger.warn('Page ' + currentPage + ' did not load in time (S.No. did not change from ' + previousFirstSlNo + '). Aborting pagination.');
          const seen = new Set();
          allEntries = allEntries.filter(e => !seen.has(e.slNo) && seen.add(e.slNo));
          callback(allEntries);
        }
      }, 500);
    }

    setTimeout(collectNextPage, 800);
  },

  computeReexamine: (cadre, office) => {
    GFPLogger.info(`computeReexamine: cadre="${cadre}", office="${office}"`);
    const cadreNorm = GFPSelect2.normalizeText(cadre);
    const officeNorm = GFPSelect2.normalizeText(office);
    
    let target = null;
    if (cadreNorm === 'GENERAL') {
      target = { name: 'MADHU DHAKA', emp: '313284' };
    } else if (cadreNorm === 'DEPOT') {
      const divyaOffices = ['RO CHANDIGARH', 'DO PATIALA', 'DO LUDHIANA', 'DO JALANDHAR', 'DO FARIDKOT', 'DO HOSHIARPUR', 'DO AMRITSAR'];
      const vishaliOffices = ['DO KAPURTHALA', 'DO FEROZEPUR', 'DO CHANDIGARH', 'DO BHATINDA', 'DO MOGA', 'DO GURDASPUR', 'DO SANGRUR'];
      
      if (divyaOffices.some(o => GFPSelect2.normalizeText(o) === officeNorm)) {
        target = { name: 'DIVYA KORNU', emp: '315172' };
      } else if (vishaliOffices.some(o => GFPSelect2.normalizeText(o) === officeNorm)) {
        target = { name: 'VISHALI MARWAHA', emp: '308235' };
      }
    }

    if (!target) {
      GFPLogger.error('INVALID_ROUTE_TARGET: Cannot resolve re-examine target for Cadre: ' + cadre + ', Office: ' + office);
      return null;
    }

    return {
      action: 'reexamine',
      target: {
        name: target.name,
        employeeNumber: target.emp,
        office: 'RO CHANDIGARH',
        officeType: '4'
      },
      remark: 'Kindly re-examine the request in light of the applicable rules and circulars of the Corporation.'
    };
  },

  computeReturnPrevious: (entries, officeValue) => {
    GFPLogger.info(`computeReturnPrevious: officeValue="${officeValue}", entries.length=${entries.length}`);
    
    let targetName = '';
    let targetOffice = '';
    let officeType = '';

    const isRoChandigarh = GFPSelect2.normalizeText(officeValue) === 'RO CHANDIGARH';
    GFPLogger.info(`computeReturnPrevious: isRoChandigarh=${isRoChandigarh}`);
    
    if (isRoChandigarh) {
      GFPLogger.info('computeReturnPrevious: RO branch - looking for Initiating employee (actionTaken="Initiated")');
      const initiator = entries.find(e => e.actionTaken === 'Initiated');
      
      if (!initiator) {
        GFPLogger.error('INVALID_ROUTE_TARGET: Initiating employee not found in action history.');
        GFPLogger.error('Available actions in entries:');
        entries.forEach((e, i) => {
          GFPLogger.error(`  [${i}] S.No=${e.slNo}, actionTaken="${e.actionTaken}", name="${e.employeeName}"`);
        });
        return null;
      }
      
      GFPLogger.info(`computeReturnPrevious: Found initiator: S.No=${initiator.slNo}, name="${initiator.employeeName}"`);
      targetName = initiator.employeeName;
      targetOffice = 'RO CHANDIGARH'; 
      officeType = '4';
    } else {
      GFPLogger.info('computeReturnPrevious: DO branch - looking for AGM landmark');
      let doManager = null;
      for (let i = 0; i < entries.length; i++) {
        const designationNorm = GFPSelect2.normalizeText(entries[i].designation);
        const remarkNorm = GFPSelect2.normalizeText(entries[i].remark);
        
        if (designationNorm === 'ASSISTANT GENERAL MANAGER' && 
            remarkNorm !== 'N/A' && 
            remarkNorm !== '') {
          GFPLogger.info(`computeReturnPrevious: Found AGM at index ${i}: S.No=${entries[i].slNo}, name="${entries[i].employeeName}", remark="${entries[i].remark.substring(0, 50)}..."`);
          if (i > 0) {
            doManager = entries[i - 1];
            GFPLogger.info(`computeReturnPrevious: DO Manager is previous entry: S.No=${doManager.slNo}, name="${doManager.employeeName}"`);
          }
          break;
        }
      }
      
      if (!doManager) {
        GFPLogger.error('INVALID_ROUTE_TARGET: DO Manager (AGM landmark) not found in action history.');
        GFPLogger.error('Available designations in entries:');
        entries.forEach((e, i) => {
          GFPLogger.error(`  [${i}] S.No=${e.slNo}, designation="${e.designation}", remark="${e.remark.substring(0, 50)}..."`);
        });
        return null;
      }
      targetName = doManager.employeeName;
      targetOffice = GFPSelect2.normalizeText(officeValue);
      officeType = '5';
    }

    return {
      action: 'returnprevious',
      target: {
        name: targetName,
        employeeNumber: '', 
        office: targetOffice,
        officeType: officeType
      },
      remark: 'The observations recorded in the action history may kindly be perused, and the requisite clarification, confirmation, or documentation furnished for further processing of the request.'
    };
  },

  computeAll: (cadre, office, entries) => {
    GFPLogger.info(`computeAll: cadre="${cadre}", office="${office}", entries.length=${entries.length}`);
    GFPPayload._cache.reexamine = GFPPayload.computeReexamine(cadre, office);
    GFPPayload._cache.returnprevious = GFPPayload.computeReturnPrevious(entries, office);
    
    GFPLogger.info(`computeAll: reexamine payload = ${GFPPayload._cache.reexamine ? 'OK' : 'NULL'}`);
    GFPLogger.info(`computeAll: returnprevious payload = ${GFPPayload._cache.returnprevious ? 'OK' : 'NULL'}`);
    
    if (GFPPayload._cache.reexamine && GFPPayload._cache.returnprevious) {
      GFPLogger.info('Payloads precomputed successfully (snapshot at initialization).');
    } else {
      GFPLogger.warn('One or more payloads failed to compute. Check errors above.');
    }
  }
};