/**
 * Google Meet Attendance Tracker - Options Page
 */

import * as sheetsApi from '../src/lib/sheets-api.js';

// DOM Elements
const elements = {
  alertMessage: document.getElementById('alertMessage'),

  // Auth
  authStatus: document.getElementById('authStatus'),
  authStatusText: document.getElementById('authStatusText'),
  connectSection: document.getElementById('connectSection'),
  connectedSection: document.getElementById('connectedSection'),
  connectBtn: document.getElementById('connectBtn'),
  disconnectBtn: document.getElementById('disconnectBtn'),

  // Sheets
  spreadsheetId: document.getElementById('spreadsheetId'),
  createSheetBtn: document.getElementById('createSheetBtn'),
  saveSheetBtn: document.getElementById('saveSheetBtn'),
  spreadsheetLink: document.getElementById('spreadsheetLink'),
  autoSync: document.getElementById('autoSync'),

  // Storage
  maxMeetings: document.getElementById('maxMeetings'),

  // Data
  meetingCount: document.getElementById('meetingCount'),
  totalParticipants: document.getElementById('totalParticipants'),
  exportAllBtn: document.getElementById('exportAllBtn'),
  importBtn: document.getElementById('importBtn'),
  importFile: document.getElementById('importFile'),
  clearAllBtn: document.getElementById('clearAllBtn')
};

/**
 * Initialize options page
 */
async function init() {
  await loadSettings();
  await checkAuthStatus();
  await loadDataStats();
  setupEventListeners();
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  elements.connectBtn.addEventListener('click', handleConnect);
  elements.disconnectBtn.addEventListener('click', handleDisconnect);
  elements.createSheetBtn.addEventListener('click', handleCreateSheet);
  elements.saveSheetBtn.addEventListener('click', handleSaveSheet);
  elements.autoSync.addEventListener('change', handleAutoSyncChange);
  elements.maxMeetings.addEventListener('change', handleMaxMeetingsChange);
  elements.exportAllBtn.addEventListener('click', handleExportAll);
  elements.importBtn.addEventListener('click', () => elements.importFile.click());
  elements.importFile.addEventListener('change', handleImport);
  elements.clearAllBtn.addEventListener('click', handleClearAll);
}

/**
 * Load settings from storage
 */
async function loadSettings() {
  const settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });

  elements.maxMeetings.value = settings.maxStoredMeetings || 100;
  elements.autoSync.checked = settings.autoSync || false;

  if (settings.spreadsheetId) {
    elements.spreadsheetId.value = settings.spreadsheetId;
    updateSpreadsheetLink(settings.spreadsheetId);
  }
}

/**
 * Check authentication status
 */
async function checkAuthStatus() {
  try {
    const isAuth = await sheetsApi.isAuthenticated();
    updateAuthUI(isAuth);
  } catch {
    updateAuthUI(false);
  }
}

/**
 * Update auth UI
 */
function updateAuthUI(isAuthenticated) {
  if (isAuthenticated) {
    elements.authStatus.className = 'status status-connected';
    elements.authStatusText.textContent = 'Connected to Google';
    elements.connectSection.classList.add('hidden');
    elements.connectedSection.classList.remove('hidden');
  } else {
    elements.authStatus.className = 'status status-disconnected';
    elements.authStatusText.textContent = 'Not connected to Google';
    elements.connectSection.classList.remove('hidden');
    elements.connectedSection.classList.add('hidden');
  }
}

/**
 * Handle connect button click
 */
async function handleConnect() {
  try {
    elements.connectBtn.disabled = true;
    elements.connectBtn.textContent = 'Connecting...';

    await sheetsApi.getAuthToken(true);
    updateAuthUI(true);
    showAlert('Successfully connected to Google!', 'success');
  } catch (error) {
    showAlert('Failed to connect: ' + error.message, 'error');
  } finally {
    elements.connectBtn.disabled = false;
    elements.connectBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
      </svg>
      Connect Google Account
    `;
  }
}

/**
 * Handle disconnect button click
 */
async function handleDisconnect() {
  if (!confirm('Are you sure you want to disconnect your Google account?')) {
    return;
  }

  try {
    const token = await sheetsApi.getAuthToken(false);
    await sheetsApi.removeCachedToken(token);

    // Clear spreadsheet settings
    await chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      settings: { spreadsheetId: null, autoSync: false }
    });

    elements.spreadsheetId.value = '';
    elements.autoSync.checked = false;
    elements.spreadsheetLink.classList.add('hidden');

    updateAuthUI(false);
    showAlert('Disconnected from Google', 'success');
  } catch (error) {
    showAlert('Failed to disconnect: ' + error.message, 'error');
  }
}

/**
 * Handle create new spreadsheet
 */
async function handleCreateSheet() {
  try {
    elements.createSheetBtn.disabled = true;
    elements.createSheetBtn.textContent = 'Creating...';

    const spreadsheet = await sheetsApi.createSpreadsheet();
    elements.spreadsheetId.value = spreadsheet.spreadsheetId;

    await chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      settings: { spreadsheetId: spreadsheet.spreadsheetId }
    });

    updateSpreadsheetLink(spreadsheet.spreadsheetId);
    showAlert('Spreadsheet created successfully!', 'success');

    // Open the spreadsheet in a new tab
    window.open(`https://docs.google.com/spreadsheets/d/${spreadsheet.spreadsheetId}/edit`, '_blank');
  } catch (error) {
    showAlert('Failed to create spreadsheet: ' + error.message, 'error');
  } finally {
    elements.createSheetBtn.disabled = false;
    elements.createSheetBtn.textContent = 'Create New Spreadsheet';
  }
}

/**
 * Handle save spreadsheet ID
 */
async function handleSaveSheet() {
  const spreadsheetId = elements.spreadsheetId.value.trim();

  if (!spreadsheetId) {
    showAlert('Please enter a spreadsheet ID', 'error');
    return;
  }

  try {
    elements.saveSheetBtn.disabled = true;

    // Verify the spreadsheet exists and is accessible
    await sheetsApi.getSpreadsheet(spreadsheetId);

    await chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      settings: { spreadsheetId }
    });

    updateSpreadsheetLink(spreadsheetId);
    showAlert('Spreadsheet ID saved!', 'success');
  } catch (error) {
    showAlert('Failed to access spreadsheet: ' + error.message, 'error');
  } finally {
    elements.saveSheetBtn.disabled = false;
  }
}

/**
 * Update spreadsheet link
 */
function updateSpreadsheetLink(spreadsheetId) {
  if (spreadsheetId) {
    elements.spreadsheetLink.href = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    elements.spreadsheetLink.classList.remove('hidden');
  } else {
    elements.spreadsheetLink.classList.add('hidden');
  }
}

/**
 * Handle auto sync toggle
 */
async function handleAutoSyncChange() {
  await chrome.runtime.sendMessage({
    type: 'UPDATE_SETTINGS',
    settings: { autoSync: elements.autoSync.checked }
  });
  showAlert('Auto-sync setting saved', 'success');
}

/**
 * Handle max meetings change
 */
async function handleMaxMeetingsChange() {
  const value = parseInt(elements.maxMeetings.value, 10);

  if (value < 10 || value > 1000) {
    elements.maxMeetings.value = 100;
    showAlert('Please enter a value between 10 and 1000', 'error');
    return;
  }

  await chrome.runtime.sendMessage({
    type: 'UPDATE_SETTINGS',
    settings: { maxStoredMeetings: value }
  });
  showAlert('Storage limit saved', 'success');
}

/**
 * Load data statistics
 */
async function loadDataStats() {
  try {
    const history = await chrome.runtime.sendMessage({
      type: 'GET_MEETING_HISTORY',
      limit: 1000
    });

    const meetingCount = history.length;
    let totalParticipants = 0;

    for (const meeting of history) {
      totalParticipants += Object.keys(meeting.participants || {}).length;
    }

    elements.meetingCount.textContent = meetingCount;
    elements.totalParticipants.textContent = totalParticipants;
  } catch (error) {
    console.error('Failed to load data stats:', error);
  }
}

/**
 * Handle export all data
 */
async function handleExportAll() {
  try {
    const data = await chrome.runtime.sendMessage({ type: 'EXPORT_ALL' });

    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `meet-attendance-export-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);

    showAlert('Data exported successfully!', 'success');
  } catch (error) {
    showAlert('Failed to export data: ' + error.message, 'error');
  }
}

/**
 * Handle import data
 */
async function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const result = await chrome.runtime.sendMessage({
      type: 'IMPORT_MEETINGS',
      data: text
    });

    if (result.success) {
      showAlert(`Imported ${result.count} meetings successfully!`, 'success');
      await loadDataStats();
    } else {
      showAlert('Failed to import: ' + result.error, 'error');
    }
  } catch (error) {
    showAlert('Failed to import data: ' + error.message, 'error');
  }

  // Reset file input
  elements.importFile.value = '';
}

/**
 * Handle clear all data
 */
async function handleClearAll() {
  if (!confirm('Are you sure you want to delete ALL meeting data? This cannot be undone.')) {
    return;
  }

  if (!confirm('This will permanently delete all attendance records. Continue?')) {
    return;
  }

  try {
    await chrome.runtime.sendMessage({ type: 'CLEAR_ALL_MEETINGS' });
    await loadDataStats();
    showAlert('All data cleared', 'success');
  } catch (error) {
    showAlert('Failed to clear data: ' + error.message, 'error');
  }
}

/**
 * Show alert message
 */
function showAlert(message, type) {
  elements.alertMessage.textContent = message;
  elements.alertMessage.className = `alert alert-${type}`;
  elements.alertMessage.classList.remove('hidden');

  setTimeout(() => {
    elements.alertMessage.classList.add('hidden');
  }, 5000);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
