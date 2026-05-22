FCI HRMS Extensions
Private repository containing Chrome extensions for automating workflow processing on the FCI HRMS portal (hrmsfci.in).
---
Repository Structure
```
FCI-HRMS-Extensions/
│
├── noc-other-examination/     ← Extension for NOC For Other Examination requests
│   ├── manifest.json
│   ├── content_noc_list.js
│   ├── content.js
│   ├── content_add_reviewer.js
│   ├── popup.html
│   ├── icon.png
│   └── CHANGELOG.md
│
├── docs/
│   └── FCI_HRMS_Technical_Reference.docx   ← Technical reference for building new extensions
│
└── README.md
```
Each extension lives in its own subfolder. New extensions for other request types will be added as additional subfolders following the same structure.
---
Extensions
Folder	Request Type	Status
`noc-other-examination`	NOC For Other Examination	Active — v3
---
How to Install an Extension in Chrome
Download or clone this repository to your local machine
Open Chrome and go to `chrome://extensions/`
Enable Developer mode (toggle at top right)
Click Load unpacked
Select the specific extension folder (e.g. `noc-other-examination`)
The extension is now active
To update after a code change: go back to `chrome://extensions/` and click the refresh icon on the extension card.
---
Technical Reference
See `docs/FCI_HRMS_Technical_Reference.docx` for a full guide on the portal structure, HTML element IDs, and step-by-step instructions for building a new extension for any other request type.
---
Important Notes
This repository is private. Do not make it public — it contains internal workflow logic and employee reference data.
Extensions never auto-submit. The final Add / OK / Submit button is always clicked manually by the officer.
Each extension activates only for its own request type, verified by the Request ID prefix on every page.
