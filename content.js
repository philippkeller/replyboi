// ReplyBoi - Content Script (runs in MAIN world)
// Intercepts fetch to detect replies on X

(function() {
  'use strict';

  if (window.__replyboiInitialized) return;
  window.__replyboiInitialized = true;

  const originalFetch = window.fetch;

  window.fetch = async function(resource, options) {
    const url = typeof resource === 'string' ? resource : resource?.url || '';
    
    if (url.includes('/CreateTweet')) {
      try {
        const response = await originalFetch.call(window, resource, options);
        
        if (response.ok || response.status === 200) {
          // Get count from localStorage, but will be synced with chrome.storage via bridge
          const count = parseInt(localStorage.getItem('replyboi_count') || '0', 10) + 1;
          localStorage.setItem('replyboi_count', String(count));
          window.postMessage({ type: 'REPLYBOI_REPLY_SENT', count }, '*');
        }
        
        return response;
      } catch (e) {
        // Silent fail
      }
    }
    
    return originalFetch.call(window, resource, options);
  };

  const XHROpen = XMLHttpRequest.prototype.open;
  const XHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._rbUrl = url;
    this._rbMethod = method;
    return XHROpen.call(this, method, url, ...args);
  };
  
  XMLHttpRequest.prototype.send = function(body) {
    if (this._rbMethod === 'POST' && this._rbUrl?.includes('/CreateTweet')) {
      this.addEventListener('load', () => {
        if (this.status >= 200 && this.status < 300) {
          const count = parseInt(localStorage.getItem('replyboi_count') || '0', 10) + 1;
          localStorage.setItem('replyboi_count', String(count));
          window.postMessage({ type: 'REPLYBOI_REPLY_SENT', count }, '*');
        }
      });
    }
    return XHRSend.call(this, body);
  };

  // Listen for reset events from bridge
  window.addEventListener('replyboi-reset', () => {
    localStorage.setItem('replyboi_count', '0');
  });
})();
