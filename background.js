// ReplyBoi - Background Service Worker
// Manages reply count and badge updates

const STORAGE_KEY = 'replyCount';

chrome.runtime.onInstalled.addListener(() => {
  initializeBadge();
  injectBridgeScript();
});

chrome.runtime.onStartup.addListener(() => {
  initializeBadge();
});

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

async function initializeBadge() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const count = result[STORAGE_KEY] || 0;
  await updateIcon(count);
}

async function updateIcon(count) {
  const text = count.toString();
  const sizes = [16, 32, 48, 128];
  const imageData = {};
  
  for (const size of sizes) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#1DA1F2');
    gradient.addColorStop(1, '#0D8ECF');
    
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
  } else if (message.type === 'GET_COUNT') {
    getCount().then(count => sendResponse({ count }));
    return true;
  } else if (message.type === 'RESET_COUNT') {
    resetCount().then(() => sendResponse({ success: true }));
    return true;
  }
});

async function handleReplySent() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const currentCount = result[STORAGE_KEY] || 0;
  const newCount = currentCount + 1;
  await chrome.storage.local.set({ [STORAGE_KEY]: newCount });
  await updateIcon(newCount);
}

async function syncCount(count) {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const currentCount = result[STORAGE_KEY] || 0;
  if (count > currentCount) {
    await chrome.storage.local.set({ [STORAGE_KEY]: count });
    await updateIcon(count);
  }
}

async function getCount() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  return result[STORAGE_KEY] || 0;
}

async function resetCount() {
  await chrome.storage.local.set({ [STORAGE_KEY]: 0 });
  await updateIcon(0);
  
  // Send reset message to all X tabs
  const tabs = await chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] });
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'RESET_LOCAL' });
    } catch (e) {}
  }
}

initializeBadge();
