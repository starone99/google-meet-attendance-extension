/**
 * Chrome Storage API Wrapper
 * Handles local storage for meeting attendance data
 */

const STORAGE_KEYS = {
  MEETINGS: 'meetings',
  CURRENT_MEETING: 'currentMeeting',
  SETTINGS: 'settings'
};

const DEFAULT_SETTINGS = {
  autoSync: false,
  syncInterval: 5, // minutes
  spreadsheetId: null,
  maxStoredMeetings: 100
};

/**
 * Get data from Chrome local storage
 */
export async function get(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key]);
    });
  });
}

/**
 * Set data in Chrome local storage
 */
export async function set(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

/**
 * Remove data from Chrome local storage
 */
export async function remove(key) {
  return new Promise((resolve) => {
    chrome.storage.local.remove([key], resolve);
  });
}

/**
 * Get all stored meetings
 */
export async function getMeetings() {
  const meetings = await get(STORAGE_KEYS.MEETINGS);
  return meetings || {};
}

/**
 * Get a specific meeting by ID
 */
export async function getMeeting(meetingId) {
  const meetings = await getMeetings();
  return meetings[meetingId] || null;
}

/**
 * Save a meeting
 */
export async function saveMeeting(meetingData) {
  const meetings = await getMeetings();
  const settings = await getSettings();

  meetings[meetingData.meetingId] = {
    ...meetingData,
    updatedAt: new Date().toISOString()
  };

  // Enforce max stored meetings limit
  const meetingIds = Object.keys(meetings);
  if (meetingIds.length > settings.maxStoredMeetings) {
    // Sort by startTime and remove oldest
    const sortedIds = meetingIds.sort((a, b) => {
      return new Date(meetings[a].startTime) - new Date(meetings[b].startTime);
    });

    const toRemove = sortedIds.slice(0, meetingIds.length - settings.maxStoredMeetings);
    toRemove.forEach(id => delete meetings[id]);
  }

  await set(STORAGE_KEYS.MEETINGS, meetings);
  return meetings[meetingData.meetingId];
}

/**
 * Update meeting participants
 */
export async function updateMeetingParticipants(meetingId, participants) {
  const meetings = await getMeetings();

  if (meetings[meetingId]) {
    meetings[meetingId].participants = participants;
    meetings[meetingId].updatedAt = new Date().toISOString();
    await set(STORAGE_KEYS.MEETINGS, meetings);
    return meetings[meetingId];
  }

  return null;
}

/**
 * Delete a meeting
 */
export async function deleteMeeting(meetingId) {
  const meetings = await getMeetings();
  if (meetings[meetingId]) {
    delete meetings[meetingId];
    await set(STORAGE_KEYS.MEETINGS, meetings);
    return true;
  }
  return false;
}

/**
 * Clear all meetings
 */
export async function clearAllMeetings() {
  await set(STORAGE_KEYS.MEETINGS, {});
}

/**
 * Get current active meeting
 */
export async function getCurrentMeeting() {
  return await get(STORAGE_KEYS.CURRENT_MEETING);
}

/**
 * Set current active meeting
 */
export async function setCurrentMeeting(meetingData) {
  await set(STORAGE_KEYS.CURRENT_MEETING, meetingData);
}

/**
 * Clear current meeting
 */
export async function clearCurrentMeeting() {
  await remove(STORAGE_KEYS.CURRENT_MEETING);
}

/**
 * Get settings
 */
export async function getSettings() {
  const settings = await get(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...settings };
}

/**
 * Update settings
 */
export async function updateSettings(newSettings) {
  const currentSettings = await getSettings();
  const updatedSettings = { ...currentSettings, ...newSettings };
  await set(STORAGE_KEYS.SETTINGS, updatedSettings);
  return updatedSettings;
}

/**
 * Get meeting history sorted by date (newest first)
 */
export async function getMeetingHistory(limit = 50) {
  const meetings = await getMeetings();
  const meetingList = Object.values(meetings);

  return meetingList
    .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
    .slice(0, limit);
}

/**
 * Export meeting to CSV format
 */
export function meetingToCSV(meeting) {
  const headers = ['Name', 'Email', 'Time', 'Type'];
  const rows = [headers.join(',')];

  const participants = meeting.participants || {};

  for (const name in participants) {
    const p = participants[name];
    const events = p.events || [];

    for (const event of events) {
      const time = event.time ? new Date(event.time).toLocaleString() : '';
      const row = [
        `"${p.name.replace(/"/g, '""')}"`,
        `"${(p.email || '').replace(/"/g, '""')}"`,
        `"${time}"`,
        event.type
      ];
      rows.push(row.join(','));
    }
  }

  return rows.join('\n');
}

/**
 * Export all meetings to JSON
 */
export async function exportAllMeetings() {
  const meetings = await getMeetings();
  return JSON.stringify(meetings, null, 2);
}

/**
 * Import meetings from JSON
 */
export async function importMeetings(jsonString) {
  try {
    const imported = JSON.parse(jsonString);
    const currentMeetings = await getMeetings();
    const merged = { ...currentMeetings, ...imported };
    await set(STORAGE_KEYS.MEETINGS, merged);
    return { success: true, count: Object.keys(imported).length };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
