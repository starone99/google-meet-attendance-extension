# Google Meet Attendance Tracker

A Chrome extension that automatically tracks participant attendance in Google Meet meetings.

## Features

- **Real-time Participant Detection**: Track participant join/leave events using MutationObserver and polling
- **Local Storage**: Secure local data storage using Chrome Storage API
- **CSV Export**: Export attendance records per meeting as CSV files
- **Meeting History Management**: View and manage past meeting records
- **Google Sheets Integration** (Optional): Auto-sync to Google Spreadsheets via OAuth2 authentication

## Installation

### Developer Mode Installation

1. Clone or download this repository:
   ```bash
   git clone https://github.com/starone99/google-meet-attendance-extension.git
   ```

2. Open Chrome browser and navigate to `chrome://extensions`

3. Enable **Developer mode** in the top right corner

4. Click **Load unpacked** button

5. Select the downloaded project folder

## Usage

### Basic Usage

1. Join a Google Meet meeting
2. The extension will automatically start tracking participants
3. Click the extension icon in the browser toolbar to view the current participant list
4. Use the **Export CSV** button to export attendance records

### Recorded Data

| Field | Description |
|-------|-------------|
| Participant Name | Display name of the meeting participant |
| Email | Shown for same-organization users (optional) |
| Join Time | Time when participant joined the meeting |
| Leave Time | Time when participant left the meeting |
| Join Count | Number of times participant rejoined |

### Google Sheets Integration (Optional)

1. Open the extension settings page
2. Click **Connect Google Account** to link your Google account
3. Click **Create New Spreadsheet** to create a new spreadsheet, or enter an existing spreadsheet ID
4. Enable the **Auto-sync** option to automatically sync when meetings end

> ⚠️ To use Google Sheets integration, you need to obtain an OAuth client ID from Google Cloud Console and replace `YOUR_CLIENT_ID` in `manifest.json`.

## Project Structure

```
google-meet-attendance-extension/
├── manifest.json              # Extension configuration (Manifest V3)
├── icons/                     # Icon files (16, 32, 48, 128px)
├── src/
│   ├── content/
│   │   └── content-script.js  # Google Meet participant detection
│   ├── background/
│   │   └── service-worker.js  # Background message handling
│   ├── popup/
│   │   ├── popup.html         # Popup UI
│   │   ├── popup.css          # Popup styles
│   │   └── popup.js           # Popup controller
│   └── lib/
│       ├── storage.js         # Chrome Storage wrapper
│       └── sheets-api.js      # Google Sheets API
└── options/
    ├── options.html           # Settings page
    └── options.js             # Settings controller
```

## Data Structure

```javascript
{
  meetingId: "abc-defg-hij",
  startTime: "2025-02-15T09:00:00Z",
  endTime: "2025-02-15T10:00:00Z",
  participants: {
    "John Doe": {
      name: "John Doe",
      email: "john@example.com",
      joinTime: "2025-02-15T09:00:00Z",
      leaveTime: "2025-02-15T10:00:00Z",
      joinCount: 1
    }
  }
}
```

## Google Cloud Console Setup (For Sheets Integration)

1. Create a new project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable "Google Sheets API" in **APIs & Services > Library**
3. Create an OAuth 2.0 Client ID in **APIs & Services > Credentials**:
   - Application type: Chrome Extension
   - Extension ID: Check in `chrome://extensions`
4. Enter the generated client ID in `manifest.json` under `oauth2.client_id`

## Permissions

This extension uses the following permissions:

- `storage`: Local storage for attendance data
- `activeTab`: Access to current Google Meet page
- `identity`: Google OAuth2 authentication (for Sheets integration)
- `host_permissions (meet.google.com)`: Run content scripts on Google Meet pages

## Known Limitations

- Participant detection may temporarily fail if Google Meet updates its DOM structure
- Email addresses are only visible for same-organization users or under certain conditions
- When a browser tab is closed, remaining participants are marked as left at that moment

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**Attribution Required**: If you use this software, you must include the original copyright notice and license in any copies or substantial portions of the software.
