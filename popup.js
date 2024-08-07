document.getElementById('sortTabs').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'sortTabs' }, () => {
    window.close();
  });
});

document.getElementById('groupAllTabs').addEventListener('click', () => {
  const groupName = prompt("Enter a name for the tab group:");
  if (groupName) {
    chrome.runtime.sendMessage({ action: 'groupAllTabs', groupName: groupName }, () => {
      window.close();
    });
  }
});

document.getElementById('removeDuplicates').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'removeDuplicates' }, () => {
    window.close();
  });
});


document.getElementById('clearBrowsingData').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'clearBrowsingDataOfCurrentTabDomain' }, () => {
    window.close();
  });
});