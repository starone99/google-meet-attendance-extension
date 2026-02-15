# Privacy Policy

**Google Meet Attendance Tracker**

Last updated: 2026-02-15

## Data We Collect

| Data | Purpose |
|------|---------|
| Google Meet participant names | To record meeting attendance |
| Participant email addresses | Displayed only when visible in Google Meet (same organization) |
| Meeting timestamps | To track join/leave event times |
| Google account info | To authenticate Google Sheets sync (optional) |

## How Data Is Stored

- All attendance data is stored **locally** in your browser using Chrome's `chrome.storage.local` API.
- No data is sent to any external server.
- If you enable Google Sheets sync, data is sent **only** to your own Google Spreadsheet via the Google Sheets API.

## Data Sharing

- We do **not** sell, share, or transfer your data to third parties.
- We do **not** use your data for advertising, analytics, or any purpose unrelated to attendance tracking.

## User Control

- You can view and delete individual meeting records from the extension popup.
- You can delete all stored data from the extension settings page.
- Uninstalling the extension removes all locally stored data.
- You can disconnect your Google account at any time from the settings page.

## Permissions

| Permission | Reason |
|------------|--------|
| `storage` | Store attendance records and settings locally |
| `activeTab` | Communicate with the Google Meet tab to detect participants |
| `host_permissions (meet.google.com)` | Run content script on Google Meet pages |
| `identity` | Google OAuth2 authentication for optional Sheets sync |

## Contact

If you have questions about this privacy policy, please open an issue at:
https://github.com/starone99/google-meet-attendance-extension/issues
