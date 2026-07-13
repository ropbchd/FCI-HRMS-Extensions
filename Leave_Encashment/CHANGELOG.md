\# Changelog — Leave Encashment Extension



\---



\## v1.0 — July 2026 (Current)



\*\*Initial release\*\*



\- `content\_leave\_list.js`: Reads Office and Encashment from the first row of the listing page, stores them in sessionStorage, then clicks the square button to open the request detail page. Table ID: `#DataTables\_Table\_0`, Request ID prefix: `CH`.

\- `content\_detail.js`: Runs on the request detail page. Automatically clicks the "Add Reviewer" button when the page loads (if triggered by the extension).

\- `content.js`: Runs on the review page. Detects Stage 1 (send to assistant) and Stage 2 (final approval). Uses Cadre from review page and Office from sessionStorage for routing. Reads Employee Name, Designation, and Before Balance from review page. Uses Encashment from sessionStorage for validation.

\- Stage 1: Routes to assistant (MADHU/DIVYA/VISHALI based on Cadre + Office) with remark "Kindly check the eligibility of the request and verify the details."

\- Stage 2: Validates D > 45 and (D-30)/2 === F. Fills dynamic final approval remark or fallback remark "Kindly re-check the requested no. of leaves to be encashed."

\- Google Sheets write-back: Sends data to configured Web App (columns: From HRMS, EL Available, Encashable, Leave Requested, Review, Final Remark). Shows warning banner if write-back fails.

\- `content\_add\_reviewer.js`: Fills Office Type (RO), Office (RO CHANDIGARH), and Employee List on the Add Reviewer page using sessionStorage handoff.

\- Safety features: Request ID prefix check (CH), trigger flag, no auto-submission, no-match = no action, highlight before acting.



\*\*Files added:\*\* `manifest.json`, `content\_leave\_list.js`, `content\_detail.js`, `content.js`, `content\_add\_reviewer.js`, `popup.html`, `CHANGELOG.md`

