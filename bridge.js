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

  // REMOVED: No more polling. Events are enough.
})();
