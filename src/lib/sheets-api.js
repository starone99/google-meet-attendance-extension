/**
 * Google Sheets API Integration
 * Handles OAuth2 authentication and Sheets API operations
 */

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

/**
 * Get OAuth2 token using Chrome Identity API
 */
export async function getAuthToken(interactive = true) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token);
      }
    });
  });
}

/**
 * Remove cached auth token (for logout or token refresh)
 */
export async function removeCachedToken(token) {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, resolve);
  });
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated() {
  try {
    const token = await getAuthToken(false);
    return !!token;
  } catch {
    return false;
  }
}

/**
 * Make authenticated API request to Google Sheets
 */
async function apiRequest(url, options = {}) {
  const token = await getAuthToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (response.status === 401) {
    // Token expired, remove and retry
    await removeCachedToken(token);
    const newToken = await getAuthToken();
    return fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${newToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    }).then(r => r.json());
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'API request failed');
  }

  return response.json();
}

/**
 * Create a new spreadsheet for attendance tracking
 */
export async function createSpreadsheet(title = 'Google Meet Attendance') {
  const data = {
    properties: {
      title
    },
    sheets: [
      {
        properties: {
          title: 'Meetings',
          gridProperties: {
            frozenRowCount: 1
          }
        }
      },
      {
        properties: {
          title: 'Participants',
          gridProperties: {
            frozenRowCount: 1
          }
        }
      }
    ]
  };

  const spreadsheet = await apiRequest(SHEETS_API_BASE, {
    method: 'POST',
    body: JSON.stringify(data)
  });

  // Initialize headers
  await initializeSpreadsheetHeaders(spreadsheet.spreadsheetId);

  return spreadsheet;
}

/**
 * Initialize spreadsheet with headers
 */
async function initializeSpreadsheetHeaders(spreadsheetId) {
  const meetingsHeaders = [
    ['Meeting ID', 'Start Time', 'End Time', 'Duration (min)', 'Participant Count', 'URL']
  ];

  const participantsHeaders = [
    ['Meeting ID', 'Name', 'Email', 'Time', 'Type']
  ];

  await batchUpdate(spreadsheetId, [
    {
      range: 'Meetings!A1:F1',
      values: meetingsHeaders
    },
    {
      range: 'Participants!A1:E1',
      values: participantsHeaders
    }
  ]);
}

/**
 * Get spreadsheet info
 */
export async function getSpreadsheet(spreadsheetId) {
  return apiRequest(`${SHEETS_API_BASE}/${spreadsheetId}`);
}

/**
 * Append data to a sheet
 */
export async function appendData(spreadsheetId, range, values) {
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  return apiRequest(url, {
    method: 'POST',
    body: JSON.stringify({ values })
  });
}

/**
 * Update data in a sheet
 */
export async function updateData(spreadsheetId, range, values) {
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  return apiRequest(url, {
    method: 'PUT',
    body: JSON.stringify({ values })
  });
}

/**
 * Batch update multiple ranges
 */
export async function batchUpdate(spreadsheetId, data) {
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values:batchUpdate`;

  return apiRequest(url, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: data.map(d => ({
        range: d.range,
        values: d.values
      }))
    })
  });
}

/**
 * Get data from a sheet
 */
export async function getData(spreadsheetId, range) {
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  return apiRequest(url);
}

/**
 * Sync a meeting to Google Sheets
 */
export async function syncMeeting(spreadsheetId, meeting) {
  const meetingId = meeting.meetingId;
  const startTime = meeting.startTime ? new Date(meeting.startTime).toLocaleString() : '';
  const endTime = meeting.endTime ? new Date(meeting.endTime).toLocaleString() : '';

  // Calculate duration
  let duration = '';
  if (meeting.startTime && meeting.endTime) {
    const durationMs = new Date(meeting.endTime) - new Date(meeting.startTime);
    duration = Math.round(durationMs / 60000).toString();
  }

  const participants = meeting.participants || {};
  const participantCount = Object.keys(participants).length;

  // Append meeting row
  const meetingRow = [
    [meetingId, startTime, endTime, duration, participantCount, meeting.url || '']
  ];

  await appendData(spreadsheetId, 'Meetings!A:F', meetingRow);

  // Append participant event rows
  if (participantCount > 0) {
    const participantRows = [];
    for (const p of Object.values(participants)) {
      const events = p.events || [];
      for (const event of events) {
        const time = event.time ? new Date(event.time).toLocaleString() : '';
        participantRows.push([
          meetingId,
          p.name,
          p.email || '',
          time,
          event.type
        ]);
      }
    }

    if (participantRows.length > 0) {
      await appendData(spreadsheetId, 'Participants!A:E', participantRows);
    }
  }

  return { success: true, meetingId, participantCount };
}

/**
 * Sync all meetings to Google Sheets
 */
export async function syncAllMeetings(spreadsheetId, meetings) {
  const results = [];

  for (const meeting of meetings) {
    try {
      const result = await syncMeeting(spreadsheetId, meeting);
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        meetingId: meeting.meetingId,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Check if a meeting has already been synced
 */
export async function isMeetingSynced(spreadsheetId, meetingId) {
  try {
    const data = await getData(spreadsheetId, 'Meetings!A:A');
    const values = data.values || [];
    return values.some(row => row[0] === meetingId);
  } catch {
    return false;
  }
}

/**
 * Get synced meeting IDs
 */
export async function getSyncedMeetingIds(spreadsheetId) {
  try {
    const data = await getData(spreadsheetId, 'Meetings!A:A');
    const values = data.values || [];
    // Skip header row
    return values.slice(1).map(row => row[0]).filter(Boolean);
  } catch {
    return [];
  }
}
