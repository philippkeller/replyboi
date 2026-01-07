// ReplyBoi - Background Service Worker
// Manages reply count, daily reset, history, and goals

const STORAGE_KEY = 'replyData';
const RESET_HOUR = 4; // 4 AM local time
const DEFAULT_GOAL = 20;

chrome.runtime.onInstalled.addListener(() => {
  initializeData();
  setupDailyAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  checkDayRollover();
  setupDailyAlarm();
});

// Set up alarm for daily reset at 4 AM
function setupDailyAlarm() {
  chrome.alarms.clear('dailyReset');
  
  const now = new Date();
  let resetTime = new Date();
  resetTime.setHours(RESET_HOUR, 0, 0, 0);
  
  if (now >= resetTime) {
    resetTime.setDate(resetTime.getDate() + 1);
  }
  
  chrome.alarms.create('dailyReset', {
    when: resetTime.getTime(),
    periodInMinutes: 24 * 60
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dailyReset') {
    checkDayRollover();
  }
});

function getTodayString() {
  const now = new Date();
  if (now.getHours() < RESET_HOUR) {
    now.setDate(now.getDate() - 1);
  }
  return now.toISOString().split('T')[0];
}

function formatDateForDisplay(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

async function getStoredData() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const data = result[STORAGE_KEY] || { today: 0, date: getTodayString(), history: [], goal: DEFAULT_GOAL };
  if (data.goal === undefined) {
    data.goal = DEFAULT_GOAL;
  }
  return data;
}

async function saveData(data) {
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
}

async function checkDayRollover() {
  const data = await getStoredData();
  const today = getTodayString();
  
  if (data.date !== today) {
    if (data.date) {
      data.history.unshift({
        date: data.date,
        count: data.today,
        goal: data.goal
      });
      data.history = data.history.slice(0, 30);
    }
    data.today = 0;
    data.date = today;
    await saveData(data);
    await resetLocalStorageInTabs();
  }
  
  await updateIcon(data.today, data.goal);
  injectBridgeScript();
}

async function resetLocalStorageInTabs() {
  const tabs = await chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] });
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'RESET_LOCAL' });
    } catch (e) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => localStorage.setItem('replyboi_count', '0'),
          world: 'MAIN'
        });
      } catch (e2) {}
    }
  }
}

async function initializeData() {
  await checkDayRollover();
}

async function injectBridgeScript() {
  try {
    const tabs = await chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] });
    for (const tab of tabs) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['bridge.js'],
          world: 'ISOLATED'
        });
      } catch (e) {}
    }
  } catch (e) {}
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    if (tab.url.includes('x.com') || tab.url.includes('twitter.com')) {
      const data = await getStoredData();
      const today = getTodayString();
      
      if (data.date === today) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId },
            func: (count) => localStorage.setItem('replyboi_count', String(count)),
            args: [data.today],
            world: 'MAIN'
          });
        } catch (e) {}
      }
      
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['bridge.js'],
          world: 'ISOLATED'
        });
      } catch (e) {}
    }
  }
});

// Get color based on progress toward goal
// 0 = Red, 1 to goal-1 = Orange, goal+ = Green
function getProgressColor(count, goal) {
  if (count === 0) {
    // Red
    return { r: 239, g: 68, b: 68 };
  } else if (count < goal) {
    // Orange - with slight gradient from red-orange to yellow-orange as you get closer
    const progress = count / goal;
    return {
      r: Math.round(239 + (249 - 239) * progress),  // 239 -> 249
      g: Math.round(68 + (115 - 68) * progress),    // 68 -> 115
      b: Math.round(68 + (22 - 68) * progress)      // 68 -> 22
    };
  } else {
    // Green (goal reached!)
    return { r: 34, g: 197, b: 94 };
  }
}

async function updateIcon(count, goal) {
  const text = count.toString();
  const sizes = [16, 32, 48, 128];
  const imageData = {};
  
  const color = getProgressColor(count, goal);
  
  for (const size of sizes) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Create gradient with progress color
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, `rgb(${color.r}, ${color.g}, ${color.b})`);
    gradient.addColorStop(1, `rgb(${Math.max(0, color.r - 30)}, ${Math.max(0, color.g - 20)}, ${Math.max(0, color.b - 20)})`);
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, size * 0.2);
    ctx.fill();
    
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    let fontSize;
    if (text.length === 1) fontSize = size * 0.7;
    else if (text.length === 2) fontSize = size * 0.55;
    else if (text.length === 3) fontSize = size * 0.4;
    else fontSize = size * 0.3;
    
    ctx.font = `bold ${fontSize}px "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = size * 0.05;
    ctx.shadowOffsetY = size * 0.02;
    ctx.fillText(text, size / 2, size / 2 + size * 0.02);
    
    imageData[size] = ctx.getImageData(0, 0, size, size);
  }
  
  await chrome.action.setIcon({ imageData });
  await chrome.action.setBadgeText({ text: '' });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'REPLY_SENT') {
    handleReplySent();
    sendResponse({ success: true });
  } else if (message.type === 'SYNC_COUNT') {
    syncCount(message.count);
    sendResponse({ success: true });
  } else if (message.type === 'GET_DATA') {
    getStoredData().then(data => {
      data.formattedHistory = data.history.map(h => ({
        ...h,
        displayDate: formatDateForDisplay(h.date)
      }));
      sendResponse(data);
    });
    return true;
  } else if (message.type === 'SET_GOAL') {
    setGoal(message.goal).then(() => sendResponse({ success: true }));
    return true;
  } else if (message.type === 'RESET_COUNT') {
    resetCount().then(() => sendResponse({ success: true }));
    return true;
  }
});

async function handleReplySent() {
  await checkDayRollover();
  const data = await getStoredData();
  data.today += 1;
  await saveData(data);
  await updateIcon(data.today, data.goal);
}

async function syncCount(count) {
  await checkDayRollover();
  const data = await getStoredData();
  if (count > data.today) {
    data.today = count;
    await saveData(data);
    await updateIcon(data.today, data.goal);
  }
}

async function setGoal(goal) {
  const data = await getStoredData();
  data.goal = goal;
  await saveData(data);
  await updateIcon(data.today, data.goal);
}

async function resetCount() {
  const data = await getStoredData();
  data.today = 0;
  await saveData(data);
  await updateIcon(0, data.goal);
  await resetLocalStorageInTabs();
}

// Initialize on load
checkDayRollover();
