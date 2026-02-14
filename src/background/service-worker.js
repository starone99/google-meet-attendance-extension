/**
 * Google Meet Attendance Tracker - Background Service Worker
 * Handles message passing and data persistence
 */

import * as storage from '../lib/storage.js';

// Track active meetings per tab
const activeMeetings = new Map();

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(error => {
      console.error('[Background] Error handling message:', error);
      sendResponse({ error: error.message });
    });
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  const tabId = sender.tab?.id;

  switch (message.type) {
    case 'MEETING_STARTED':
      return handleMeetingStarted(message, tabId);

    case 'MEETING_ENDED':
      return handleMeetingEnded(message, tabId);

    case 'ATTENDANCE_UPDATE':
      return handleAttendanceUpdate(message, tabId);

    case 'GET_CURRENT_MEETING':
      return getCurrentMeetingStatus(tabId);

    case 'GET_MEETING_HISTORY':
      return getMeetingHistory(message.limit);

    case 'GET_MEETING':
      return storage.getMeeting(message.meetingId);

    case 'DELETE_MEETING':
      return storage.deleteMeeting(message.meetingId);

    case 'EXPORT_MEETING_CSV':
      return exportMeetingCSV(message.meetingId);

    case 'GET_SETTINGS':
      return storage.getSettings();

    case 'UPDATE_SETTINGS':
      return storage.updateSettings(message.settings);

    case 'EXPORT_ALL':
      return storage.exportAllMeetings();

    case 'IMPORT_MEETINGS':
      return storage.importMeetings(message.data);

    case 'CLEAR_ALL_MEETINGS':
      return storage.clearAllMeetings();

    default:
      console.warn('[Background] Unknown message type:', message.type);
      return { error: 'Unknown message type' };
  }
}

/**
 * Handle meeting start
 */
async function handleMeetingStarted(message, tabId) {
  console.log('[Background] Meeting started:', message.meetingId);

  const meetingData = {
    meetingId: message.meetingId,
    startTime: message.startTime,
    endTime: null,
    url: message.url,
    participants: {},
    tabId: tabId
  };

  // Track in memory for this tab
  if (tabId) {
    activeMeetings.set(tabId, meetingData);
  }

  // Save to storage
  await storage.setCurrentMeeting(meetingData);
  await storage.saveMeeting(meetingData);

  // Update badge to show tracking
  updateBadge(tabId, 'ON', '#1a73e8');

  return { success: true, meetingId: message.meetingId };
}

/**
 * Handle meeting end
 */
async function handleMeetingEnded(message, tabId) {
  console.log('[Background] Meeting ended:', message.meetingId);

  const meetingData = {
    meetingId: message.meetingId,
    endTime: message.endTime,
    participants: message.participants
  };

  // Get existing meeting data
  const existing = await storage.getMeeting(message.meetingId);
  if (existing) {
    const updated = {
      ...existing,
      ...meetingData,
      endTime: message.endTime
    };
    await storage.saveMeeting(updated);
  }

  // Clear current meeting
  await storage.clearCurrentMeeting();

  // Remove from active meetings
  if (tabId) {
    activeMeetings.delete(tabId);
  }

  // Update badge
  updateBadge(tabId, '', '');

  return { success: true };
}

/**
 * Handle attendance updates
 */
async function handleAttendanceUpdate(message, tabId) {
  const { meetingId, participants, action, data } = message;

  // Update in-memory tracking
  if (tabId && activeMeetings.has(tabId)) {
    const meeting = activeMeetings.get(tabId);
    meeting.participants = participants;
    activeMeetings.set(tabId, meeting);
  }

  // Save to storage
  await storage.updateMeetingParticipants(meetingId, participants);

  // Update badge with participant count
  const count = Object.keys(participants).length;
  updateBadge(tabId, count.toString(), '#1a73e8');

  // Log the event
  console.log(`[Background] ${action}:`, data?.name || 'unknown');

  return { success: true };
}

/**
 * Get current meeting status
 */
async function getCurrentMeetingStatus(tabId) {
  // Check in-memory first
  if (tabId && activeMeetings.has(tabId)) {
    return {
      active: true,
      meeting: activeMeetings.get(tabId)
    };
  }

  // Check storage
  const current = await storage.getCurrentMeeting();
  return {
    active: !!current,
    meeting: current
  };
}

/**
 * Get meeting history
 */
async function getMeetingHistory(limit = 50) {
  return storage.getMeetingHistory(limit);
}

/**
 * Export meeting to CSV
 */
async function exportMeetingCSV(meetingId) {
  const meeting = await storage.getMeeting(meetingId);
  if (!meeting) {
    return { error: 'Meeting not found' };
  }

  const csv = storage.meetingToCSV(meeting);
  return { csv, meetingId, filename: `attendance_${meetingId}_${Date.now()}.csv` };
}

/**
 * Update extension badge
 */
function updateBadge(tabId, text, color) {
  const options = { text };
  if (tabId) {
    options.tabId = tabId;
  }

  chrome.action.setBadgeText(options);

  if (color) {
    chrome.action.setBadgeBackgroundColor({
      color,
      ...(tabId ? { tabId } : {})
    });
  }
}

/**
 * Handle tab close - end meeting tracking
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeMeetings.has(tabId)) {
    const meeting = activeMeetings.get(tabId);
    console.log('[Background] Tab closed, ending meeting:', meeting.meetingId);

    // Mark all participants as left
    const endTime = new Date().toISOString();
    for (const name in meeting.participants) {
      if (meeting.participants[name].isPresent) {
        meeting.participants[name].events.push({ time: endTime, type: 'Leave' });
        meeting.participants[name].isPresent = false;
      }
    }

    // Save final state
    storage.saveMeeting({
      ...meeting,
      endTime
    });

    activeMeetings.delete(tabId);
    storage.clearCurrentMeeting();
  }
});

/**
 * Handle extension install/update
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Background] Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    // Set default settings
    await storage.updateSettings({});
    console.log('[Background] Default settings initialized');
  }
});

/**
 * Keep service worker alive during active meetings
 */
setInterval(() => {
  if (activeMeetings.size > 0) {
    console.log('[Background] Active meetings:', activeMeetings.size);
  }
}, 20000);

console.log('[Background] Service worker started');
