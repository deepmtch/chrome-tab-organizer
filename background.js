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
          if (chrome.runtime.lastError) {
            console.error("Error creating group:", chrome.runtime.lastError);
          } else {
            chrome.tabGroups.update(groupId, { title: domain }).catch(error => {
              console.error("Error updating group:", error);
            });
          }
        });
      }
    });
  });
}

function groupAllTabs(groupName) {
  chrome.tabs.query({ currentWindow: true }, (tabs) => {
    const tabIds = tabs.map(tab => tab.id);
    chrome.tabs.group({ tabIds }, (groupId) => {
      if (chrome.runtime.lastError) {
        console.error("Error creating group:", chrome.runtime.lastError);
      } else {
        chrome.tabGroups.update(groupId, { title: groupName }).catch(error => {
          console.error("Error updating group:", error);
        });
      }
    });
  });
}

function removeDuplicates(sendResponse) {
  chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
    if (chrome.runtime.lastError) {
      console.error("Error querying active tab:", chrome.runtime.lastError);
      sendResponse({ error: "Error querying active tab" });
      return;
    }
    if (activeTabs.length === 0) {
      console.error("No active tab found");
      sendResponse({ error: "No active tab found" });
      return;
    }

    const activeTab = activeTabs[0];
    const activeUrl = new URL(activeTab.url);
    const activeDomain = activeUrl.hostname;

    console.log("Active domain:", activeDomain);

    chrome.tabs.query({ currentWindow: true }, (allTabs) => {
      if (chrome.runtime.lastError) {
        console.error("Error querying all tabs:", chrome.runtime.lastError);
        sendResponse({ error: "Error querying all tabs" });
        return;
      }
      const tabsOfSameDomain = allTabs.filter(tab => {
        try {
          const url = new URL(tab.url);
          return url.hostname === activeDomain && tab.id !== activeTab.id; // Exclude the active tab
        } catch (error) {
          console.error("Error parsing URL for tab:", tab, error);
          return false;
        }
      });

      console.log("Duplicate tabs of same domain:", tabsOfSameDomain.length);

      if (tabsOfSameDomain.length > 0) {
        const tabIds = tabsOfSameDomain.map(tab => tab.id);
        console.log("Sending response:", { domain: activeDomain, count: tabsOfSameDomain.length, tabIds: tabIds });
        sendResponse({ 
          domain: activeDomain, 
          count: tabsOfSameDomain.length, 
          tabIds: tabIds 
        });
      } else {
        console.log("No duplicate tabs found");
        sendResponse({ message: `No duplicate tabs found for ${activeDomain}` });
      }
    });
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

// Message listener for extension actions
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Received message:", request);
  if (request.action === 'sortTabs') {
    sortTabs();
    sendResponse({});
  } else if (request.action === 'groupAllTabs') {
    groupAllTabs(request.groupName);
    sendResponse({});
  } else if (request.action === 'removeDuplicates') {
    removeDuplicates(sendResponse);
    return true;  // Indicates we will send a response asynchronously
  } else if (request.action === 'clearBrowsingDataOfCurrentTabDomain') {
    clearBrowsingDataOfCurrentTabDomain();
    sendResponse({});
  } else if (request.action === 'closeTabs') {
    chrome.tabs.remove(request.tabIds, () => {
      if (chrome.runtime.lastError) {
        console.error("Error closing tabs:", chrome.runtime.lastError);
        sendResponse({ error: "Error closing tabs" });
      } else {
        sendResponse({ message: `Closed ${request.tabIds.length} tabs` });
      }
    });
    return true;  // Indicates we will send a response asynchronously
  }
});