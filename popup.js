// ReplyBoi - Popup Script

function getColorClass(count, goal) {
  const progress = count / goal;
  if (progress === 0) return 'red';
  if (progress < 1) return 'orange';
  return 'green';
}

document.addEventListener('DOMContentLoaded', async () => {
  const countEl = document.getElementById('count');
  const goalDisplay = document.getElementById('goalDisplay');
  const goalInput = document.getElementById('goalInput');
  const progressFill = document.getElementById('progressFill');
  const historyBody = document.getElementById('historyBody');
  const noHistory = document.getElementById('noHistory');

  // Get current data
  const data = await chrome.runtime.sendMessage({ type: 'GET_DATA' });
  const count = data.today || 0;
  const goal = data.goal || 20;
  
  // Update today's count
  countEl.textContent = count;
  goalDisplay.textContent = goal;
  goalInput.value = goal;
  
  // Set color based on progress
  const colorClass = getColorClass(count, goal);
  countEl.className = 'count ' + colorClass;
  progressFill.className = 'progress-fill ' + colorClass;
  
  // Set progress bar width
  const progress = Math.min((count / goal) * 100, 100);
  progressFill.style.width = progress + '%';

  // Handle goal change
  let debounceTimer;
  goalInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const newGoal = parseInt(goalInput.value, 10);
      if (newGoal > 0 && newGoal <= 999) {
        await chrome.runtime.sendMessage({ type: 'SET_GOAL', goal: newGoal });
        goalDisplay.textContent = newGoal;
        
        // Update colors
        const newColorClass = getColorClass(count, newGoal);
        countEl.className = 'count ' + newColorClass;
        progressFill.className = 'progress-fill ' + newColorClass;
        
        // Update progress bar
        const newProgress = Math.min((count / newGoal) * 100, 100);
        progressFill.style.width = newProgress + '%';
      }
    }, 300);
  });

  // Populate history
  if (data.formattedHistory && data.formattedHistory.length > 0) {
    noHistory.style.display = 'none';
    
    data.formattedHistory.forEach(entry => {
      const entryGoal = entry.goal || 20;
      const colorClass = getColorClass(entry.count, entryGoal);
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${entry.displayDate}</td>
        <td class="${colorClass}">${entry.count}</td>
      `;
      historyBody.appendChild(row);
    });
  } else {
    noHistory.style.display = 'block';
    document.getElementById('historyTable').querySelector('thead').style.display = 'none';
  }
});
