// ReplyBoi - Bridge Script (runs in ISOLATED world)
// Communicates between MAIN world and background service worker

(function() {
  'use strict';

  // Listen for reply events from content script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== 'REPLYBOI_REPLY_SENT') return;
    
    chrome.runtime.sendMessage({
      type: 'REPLY_SENT',
      isOwnTweet: false
    });
  });

  // Listen for reset messages from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'RESET_LOCAL') {
      localStorage.setItem('replyboi_count', '0');
      window.dispatchEvent(new CustomEvent('replyboi-reset'));
      sendResponse({ success: true });
    }
  });

  // Sync localStorage with chrome.storage periodically
  let lastKnownCount = localStorage.getItem('replyboi_count') || '0';
  
  setInterval(() => {
    const currentCount = localStorage.getItem('replyboi_count') || '0';
    if (currentCount !== lastKnownCount) {
      lastKnownCount = currentCount;
      chrome.runtime.sendMessage({
        type: 'SYNC_COUNT',
        count: parseInt(currentCount, 10)
      });
    }
  }, 500);
})();
