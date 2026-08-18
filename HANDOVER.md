# FCI HRMS Extensions – Hand‑over Summary

## 📁 Project Overview
- **Local folder**: `c:/Users/ACER/Downloads/FCI-HRMS-Extensions-main`
- **GitHub repo**: https://github.com/ropbchd/FCI-HRMS-Extensions
- **Current branch**: `main`
- **Status**: All duplicate folders have been cleaned up and the repository is fully synced with GitHub.

## 🧹 Cleaned & Consolidated Folder Structure
| Canonical Folder | Description |
|---|---|
| `audit-leave-extension` | Leave audit workflow extension |
| `calp-assistant` | Competency & Learning Profile assistant |
| `Employee_LTC_Requests` | Long‑Term Concession requests |
| `Employee_Profile_Update` | Profile update extension |
| `Higher_Studies_Distance` | Higher‑studies / distance‑learning extension |
| `Leave_Encashment` | Leave encashment workflow (merged old folder) |
| `noc-other-examination` | v5.0 Floating Window Framework example (NOC‑Other‑Examination) |
| `noc-passport` | Passport‑related requests |
| `OTA Requets` | On‑the‑Air requests |
| `Floating_Penal` | Architecture & design docs for the Floating Window Framework |
| `FCI_HRMS_Technical_Reference.docx` | Technical reference document |
| `Project_Context_Document.docx` | Project context & scope |
| `README.md` | High‑level project description |

## 🔧 How to Add a New Extension
When you want to create a new Chrome extension for a new HRMS request, gather the following information and provide it to the assistant:
1. **Request name** (e.g., *Child Care Leave*) and a short code/prefix (e.g., `ccl`).
2. **Target URLs** – list‑page, review/approval page, and reviewer‑selection modal URLs.
3. **Workflow stages** – number of stages, how each stage is identified on screen, and which designation/office should be auto‑selected at each stage.
4. **Floating‑window features** – buttons, reminders, or checklists you want inside the floating UI.
5. (Optional) **HTML snippets or screenshots** of the review form and the “Add Reviewer” modal so we can capture exact element selectors.

Once you provide these, the assistant will generate a full extension skeleton (`manifest.json`, `content.js`, `content_add_reviewer.js`, `floating_window.js`, `floating_window.css`) that follows the existing v5.0 Floating Window Framework.

## 📚 Development Workflow
- **Clone / Pull**: `git pull origin main` to get the latest clean repo.
- **Create a new branch** for your extension, e.g. `git checkout -b feature/child-care-leave`.
- **Add the generated extension folder** under the repo root.
- **Commit & push** when ready: `git add . && git commit -m "Add Child Care Leave extension" && git push -u origin feature/child-care-leave`.
- **Open a PR** on GitHub for review.

## 🔄 Continuing the Conversation
- The hand‑over file is now in the same folder as the project.
- When you start a new Gemini chat with a different Google account, simply open this `HANDOVER.md` (or copy its contents) and paste it into the new conversation. All context—repository location, current status, and the “how‑to‑add‑extension” checklist—will be available, letting you pick up exactly where we left off.

---
*Prepared by Antigravity on 2026‑08‑12.*
