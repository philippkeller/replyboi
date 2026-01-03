// ReplyBoi - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  const countEl = document.getElementById('count');
  const resetBtn = document.getElementById('resetBtn');

  // Get current count
  const response = await chrome.runtime.sendMessage({ type: 'GET_COUNT' });
  countEl.textContent = response.count || 0;

  // Handle reset
  resetBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'RESET_COUNT' });
    countEl.textContent = '0';
    
    // Add a little animation
    countEl.style.transform = 'scale(1.2)';
    setTimeout(() => {
      countEl.style.transform = 'scale(1)';
    }, 150);
  });
});


