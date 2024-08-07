function sortTabs() {
  chrome.tabs.query({}, (tabs) => {
    const groups = {};
    const tabOrder = [];
    tabs.forEach((tab) => {
      const url = new URL(tab.url);
      const domain = url.hostname;
      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push(tab.id);
      tabOrder.push(tab.id);
    });

    Object.entries(groups).forEach(([domain, tabIds]) => {
      if (tabIds.length > 1) {
        chrome.tabs.group({ tabIds }, (groupId) => {
          chrome.tabGroups.update(groupId, { title: domain });
        });
      }
    });

    // Move tabs to maintain their order
    tabOrder.forEach((tabId, index) => {
      chrome.tabs.move(tabId, {index: index});
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
    const domains = {};
    const tabsToClose = [];

    tabs.forEach((tab) => {
      const url = new URL(tab.url);
      const domain = url.hostname;
      
      if (!domains[domain]) {
        domains[domain] = tab.id;
      } else {
        tabsToClose.push(tab.id);
      }
    });

    if (tabsToClose.length > 0) {
      chrome.tabs.remove(tabsToClose, () => {
        console.log(`Closed ${tabsToClose.length} duplicate tabs.`);
      });
    } else {
      console.log("No duplicate tabs found.");
    }
  });
}

function moveTabToRight(tabId) {
  chrome.tabs.move(tabId, {index: -1});
}

function setupTabListeners() {
  chrome.tabs.onActivated.addListener((activeInfo) => {
    moveTabToRight(activeInfo.tabId);
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      moveTabToRight(tabId);
    }
  });
}

function clearBrowsingDataOfCurrentTabDomain() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) {
      return;
    }
    const currentTab = tabs[0];
    const url = new URL(currentTab.url);
    const domain = url.origin;
    
    chrome.browsingData.remove({
      origins: [domain]
    }, {
      appcache: true,
      cache: true,
      cacheStorage: true,
      cookies: true,
      fileSystems: true,
      indexedDB: true,
      localStorage: true,
      serviceWorkers: true,
      webSQL: true
    }, () => {
      console.log(`Browsing data for ${domain} cleared.`);
    });
  });
}

// Set up listeners when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  setupTabListeners();
});

// Message listener for extension actions
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sortTabs') {
    sortTabs();
  } else if (request.action === 'groupAllTabs') {
    groupAllTabs(request.groupName);
  } else if (request.action === 'removeDuplicates') {
    removeDuplicates();
  } else if (request.action === 'clearBrowsingDataOfCurrentTabDomain') {
    clearBrowsingDataOfCurrentTabDomain();
  }
  sendResponse({});
});