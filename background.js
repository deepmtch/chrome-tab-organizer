function sortTabs() {
  chrome.tabs.query({}, (tabs) => {
    const groups = {};
    tabs.forEach((tab) => {
      const url = new URL(tab.url);
      const domain = url.hostname;
      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push(tab.id);
    });

    Object.entries(groups).forEach(([domain, tabIds]) => {
      if (tabIds.length > 1) {
        chrome.tabs.group({ tabIds }, (groupId) => {
          chrome.tabGroups.update(groupId, { title: domain });
        });
      }
    });
  });
}

function groupAllTabs(groupName) {
  chrome.tabs.query({ currentWindow: true }, (tabs) => {
    const tabIds = tabs.map(tab => tab.id);
    chrome.tabs.group({ tabIds }, (groupId) => {
      chrome.tabGroups.update(groupId, { title: groupName });
    });
  });
}

function removeDuplicates() {
  chrome.tabs.query({}, (tabs) => {
    const uniqueUrls = new Set();
    const duplicates = [];
    const similarTabs = {};

    tabs.forEach((tab) => {
      const url = new URL(tab.url);
      const domain = url.hostname;
      
      if (uniqueUrls.has(tab.url)) {
        duplicates.push(tab.id);
      } else {
        uniqueUrls.add(tab.url);
        if (!similarTabs[domain]) {
          similarTabs[domain] = [];
        }
        similarTabs[domain].push(tab);
      }
    });

    // Close exact duplicates
    if (duplicates.length > 0) {
      chrome.tabs.remove(duplicates);
    }

    // Ask user about similar tabs
    Object.values(similarTabs).forEach((domainTabs) => {
      if (domainTabs.length > 1) {
        const tabsToClose = domainTabs.slice(1);
        tabsToClose.forEach((tab) => {
          if (confirm(`Close similar tab?\n\n${tab.title}\n${tab.url}`)) {
            chrome.tabs.remove(tab.id);
          }
        });
      }
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sortTabs') {
    sortTabs();
  } else if (request.action === 'groupAllTabs') {
    groupAllTabs(request.groupName);
  } else if (request.action === 'removeDuplicates') {
    removeDuplicates();
  }
  sendResponse({});
});