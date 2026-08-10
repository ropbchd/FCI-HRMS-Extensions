\# Changelog — Leave Encashment Extension



\---



\## v1.2 — July 2026 (Current)



\*\*Bug fix: Extension landing on Action History page instead of Review page\*\*



\- Fixed the flow to properly handle the Action History page (`/workflow/action-history/\*`).

\- Added new `content\_action\_history.js` script that runs on the Action History page.

\- Updated `content\_detail.js` to read Cadre from the detail page and store it in sessionStorage.

\- Updated `manifest.json` to include the Action History page URL pattern.

\- The extension now correctly:

&#x20; 1. Reads Office and Encashment from the listing page

&#x20; 2. Opens the detail page and reads Cadre

&#x20; 3. Clicks "View Action History" to go to the Action History page

&#x20; 4. Detects Stage 1 and clicks "Add Reviewer" on the Action History page

&#x20; 5. Fills the Add Reviewer form

&#x20; 6. After assistant reviews, fills the final approval remark on the Review page



\*\*Files changed:\*\* `manifest.json`, `content\_detail.js`, `content\_action\_history.js` (new)



\---



\## v1.1 — July 2026



\*\*Bug fix: Office not being read from listing page\*\*



\- Fixed issue where Office (place of posting) was not being stored correctly from the listing page.

\- Added detailed logging in `content\_leave\_list.js`.

\- Added fallback in `content.js` to read Office from the Competent Authority section.



\*\*Files changed:\*\* `content\_leave\_list.js`, `content.js`



\---



\## v1.0 — July 2026



\*\*Initial release\*\*



\- `content\_leave\_list.js`: Reads Office and Encashment from the first row of the listing page, stores them in sessionStorage, then clicks the square button to open the request detail page.

\- `content\_detail.js`: Runs on the request detail page. Reads Cadre, then clicks "View Action History".

\- `content.js`: Runs on the review page. Detects Stage 1 (send to assistant) and Stage 2 (final approval).

\- `content\_action\_history.js`: Runs on the Action History page. Detects Stage 1 and clicks "Add Reviewer".

\- `content\_add\_reviewer.js`: Fills Office Type (RO), Office (RO CHANDIGARH), and Employee List on the Add Reviewer page.

\- Google Sheets write-back: Sends data to configured Web App.



\*\*Files added:\*\* `manifest.json`, `content\_leave\_list.js`, `content\_detail.js`, `content\_action\_history.js`, `content.js`, `content\_add\_reviewer.js`, `popup.html`, `CHANGELOG.md`

