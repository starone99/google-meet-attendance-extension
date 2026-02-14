/**
 * Google Meet Attendance Tracker - Popup UI
 */

// DOM Elements
const elements = {
  // Current meeting
  currentMeetingSection: document.getElementById('currentMeetingSection'),
  statusBadge: document.getElementById('statusBadge'),
  meetingInfo: document.getElementById('meetingInfo'),
  noMeeting: document.getElementById('noMeeting'),
  meetingId: document.getElementById('meetingId'),
  startTime: document.getElementById('startTime'),
  participantCount: document.getElementById('participantCount'),

  // Participants
  participantsSection: document.getElementById('participantsSection'),
  participantList: document.getElementById('participantList'),
  refreshBtn: document.getElementById('refreshBtn'),

  // Actions
  actionsSection: document.getElementById('actionsSection'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),
  syncSheetsBtn: document.getElementById('syncSheetsBtn'),

  // History
  historySection: document.getElementById('historySection'),
  historyList: document.getElementById('historyList'),
  noHistory: document.getElementById('noHistory'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),

  // Settings
  settingsBtn: document.getElementById('settingsBtn'),

  // Modal
  meetingModal: document.getElementById('meetingModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalBody: document.getElementById('modalBody'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  modalExportBtn: document.getElementById('modalExportBtn'),
  modalDeleteBtn: document.getElementById('modalDeleteBtn')
};

// State
let currentMeeting = null;
let selectedMeetingId = null;

/**
 * Initialize popup
 */
async function init() {
  await loadCurrentMeeting();
  await loadMeetingHistory();
  setupEventListeners();

  // Auto-refresh every 5 seconds while popup is open
  setInterval(loadCurrentMeeting, 5000);
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  elements.refreshBtn.addEventListener('click', handleRefresh);
  elements.exportCsvBtn.addEventListener('click', () => exportCurrentMeetingCSV());
  elements.syncSheetsBtn.addEventListener('click', handleSyncSheets);
  elements.clearHistoryBtn.addEventListener('click', handleClearHistory);
  elements.settingsBtn.addEventListener('click', openSettings);
  elements.closeModalBtn.addEventListener('click', closeModal);
  elements.modalExportBtn.addEventListener('click', () => exportMeetingCSV(selectedMeetingId));
  elements.modalDeleteBtn.addEventListener('click', () => deleteMeeting(selectedMeetingId));
}

/**
 * Load current meeting status from content script
 */
async function loadCurrentMeeting() {
  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url?.includes('meet.google.com')) {
      showNoMeeting();
      return;
    }

    // Get status from content script
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' });

    if (response && response.isTracking) {
      currentMeeting = {
        meetingId: response.meetingId,
        participants: response.participants,
        participantCount: response.participantCount
      };
      showCurrentMeeting(response);
    } else {
      showNoMeeting();
    }
  } catch (error) {
    console.error('Failed to load current meeting:', error);
    showNoMeeting();
  }
}

/**
 * Show current meeting UI
 */
function showCurrentMeeting(data) {
  elements.statusBadge.textContent = 'Active';
  elements.statusBadge.className = 'badge badge-active';
  elements.meetingInfo.classList.remove('hidden');
  elements.noMeeting.classList.add('hidden');
  elements.participantsSection.classList.remove('hidden');
  elements.actionsSection.classList.remove('hidden');

  elements.meetingId.textContent = data.meetingId || '-';
  elements.participantCount.textContent = data.participantCount || 0;

  // Render participants
  renderParticipants(data.participants);
}

/**
 * Show no meeting UI
 */
function showNoMeeting() {
  currentMeeting = null;
  elements.statusBadge.textContent = 'Not Active';
  elements.statusBadge.className = 'badge badge-inactive';
  elements.meetingInfo.classList.add('hidden');
  elements.noMeeting.classList.remove('hidden');
  elements.participantsSection.classList.add('hidden');
  elements.actionsSection.classList.add('hidden');
}

/**
 * Render participant list
 */
function renderParticipants(participants) {
  if (!participants || Object.keys(participants).length === 0) {
    elements.participantList.innerHTML = '<div class="empty-state"><p>No participants yet</p></div>';
    return;
  }

  const html = Object.values(participants).map(p => {
    const isActive = p.isPresent;
    const statusClass = isActive ? 'status-active' : 'status-left';
    const lastEvent = p.events && p.events.length > 0 ? p.events[p.events.length - 1] : null;
    const lastTime = lastEvent ? new Date(lastEvent.time).toLocaleTimeString() : '-';
    const lastType = lastEvent ? lastEvent.type : '';

    return `
      <div class="participant-item">
        <div style="display: flex; align-items: center;">
          <span class="participant-status ${statusClass}"></span>
          <div class="participant-info">
            <div class="participant-name">${escapeHtml(p.name)}</div>
            ${p.email ? `<div class="participant-email">${escapeHtml(p.email)}</div>` : ''}
          </div>
        </div>
        <div class="participant-time">
          ${lastType} ${lastTime}
        </div>
      </div>
    `;
  }).join('');

  elements.participantList.innerHTML = html;
}

/**
 * Load meeting history
 */
async function loadMeetingHistory() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_MEETING_HISTORY',
      limit: 20
    });

    if (response && response.length > 0) {
      renderHistory(response);
      elements.noHistory.classList.add('hidden');
      elements.historyList.classList.remove('hidden');
    } else {
      elements.noHistory.classList.remove('hidden');
      elements.historyList.classList.add('hidden');
    }
  } catch (error) {
    console.error('Failed to load meeting history:', error);
  }
}

/**
 * Render meeting history
 */
function renderHistory(meetings) {
  const html = meetings.map(meeting => {
    const date = meeting.startTime ? new Date(meeting.startTime).toLocaleDateString() : '-';
    const time = meeting.startTime ? new Date(meeting.startTime).toLocaleTimeString() : '';
    const participantCount = Object.keys(meeting.participants || {}).length;

    return `
      <div class="history-item" data-meeting-id="${escapeHtml(meeting.meetingId)}">
        <div class="history-info">
          <div class="history-id">${escapeHtml(meeting.meetingId)}</div>
          <div class="history-date">${date} ${time}</div>
        </div>
        <span class="history-count">${participantCount} participants</span>
      </div>
    `;
  }).join('');

  elements.historyList.innerHTML = html;

  // Add click handlers
  elements.historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      const meetingId = item.dataset.meetingId;
      showMeetingDetails(meetingId);
    });
  });
}

/**
 * Show meeting details in modal
 */
async function showMeetingDetails(meetingId) {
  try {
    const meeting = await chrome.runtime.sendMessage({
      type: 'GET_MEETING',
      meetingId
    });

    if (!meeting) {
      alert('Meeting not found');
      return;
    }

    selectedMeetingId = meetingId;
    elements.modalTitle.textContent = `Meeting: ${meetingId}`;

    const startTime = meeting.startTime ? new Date(meeting.startTime).toLocaleString() : '-';
    const endTime = meeting.endTime ? new Date(meeting.endTime).toLocaleString() : 'Ongoing';
    const participants = meeting.participants || {};
    const participantCount = Object.keys(participants).length;

    let html = `
      <div class="meeting-info" style="margin-bottom: 16px;">
        <div class="info-row">
          <span class="label">Started:</span>
          <span class="value">${startTime}</span>
        </div>
        <div class="info-row">
          <span class="label">Ended:</span>
          <span class="value">${endTime}</span>
        </div>
        <div class="info-row">
          <span class="label">Participants:</span>
          <span class="value">${participantCount}</span>
        </div>
      </div>
    `;

    if (participantCount > 0) {
      html += '<h3 style="font-size: 14px; margin-bottom: 8px;">Participants</h3>';
      html += '<div class="participant-list">';

      for (const p of Object.values(participants)) {
        const events = p.events || [];
        const eventsHtml = events.map(e => {
          const time = new Date(e.time).toLocaleTimeString();
          return `<div>${e.type} - ${time}</div>`;
        }).join('');

        html += `
          <div class="participant-item">
            <div class="participant-info">
              <div class="participant-name">${escapeHtml(p.name)}</div>
              ${p.email ? `<div class="participant-email">${escapeHtml(p.email)}</div>` : ''}
            </div>
            <div class="participant-time">
              ${eventsHtml}
            </div>
          </div>
        `;
      }

      html += '</div>';
    }

    elements.modalBody.innerHTML = html;
    elements.meetingModal.classList.remove('hidden');
  } catch (error) {
    console.error('Failed to load meeting details:', error);
    alert('Failed to load meeting details');
  }
}

/**
 * Close modal
 */
function closeModal() {
  elements.meetingModal.classList.add('hidden');
  selectedMeetingId = null;
}

/**
 * Handle refresh button click
 */
async function handleRefresh() {
  elements.refreshBtn.classList.add('loading');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url?.includes('meet.google.com')) {
      await chrome.tabs.sendMessage(tab.id, { type: 'FORCE_SCAN' });
    }
    await loadCurrentMeeting();
  } finally {
    elements.refreshBtn.classList.remove('loading');
  }
}

/**
 * Export current meeting to CSV
 */
async function exportCurrentMeetingCSV() {
  if (!currentMeeting) return;
  await exportMeetingCSV(currentMeeting.meetingId);
}

/**
 * Export meeting to CSV
 */
async function exportMeetingCSV(meetingId) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'EXPORT_MEETING_CSV',
      meetingId
    });

    if (response.error) {
      alert('Failed to export: ' + response.error);
      return;
    }

    // Download CSV
    const blob = new Blob([response.csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = response.filename;
    link.click();
    URL.revokeObjectURL(url);

    closeModal();
  } catch (error) {
    console.error('Failed to export CSV:', error);
    alert('Failed to export CSV');
  }
}

/**
 * Handle sync to Google Sheets
 */
async function handleSyncSheets() {
  // Check if authenticated
  const settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });

  if (!settings.spreadsheetId) {
    alert('Please configure Google Sheets in settings first.');
    openSettings();
    return;
  }

  // TODO: Implement sync
  alert('Google Sheets sync will be implemented in the settings page.');
}

/**
 * Delete a meeting
 */
async function deleteMeeting(meetingId) {
  if (!confirm('Are you sure you want to delete this meeting record?')) {
    return;
  }

  try {
    await chrome.runtime.sendMessage({
      type: 'DELETE_MEETING',
      meetingId
    });

    closeModal();
    await loadMeetingHistory();
  } catch (error) {
    console.error('Failed to delete meeting:', error);
    alert('Failed to delete meeting');
  }
}

/**
 * Handle clear history
 */
async function handleClearHistory() {
  if (!confirm('Are you sure you want to clear all meeting history?')) {
    return;
  }

  try {
    await chrome.runtime.sendMessage({ type: 'CLEAR_ALL_MEETINGS' });
    await loadMeetingHistory();
  } catch (error) {
    console.error('Failed to clear history:', error);
    alert('Failed to clear history');
  }
}

/**
 * Open settings page
 */
function openSettings() {
  chrome.runtime.openOptionsPage();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
