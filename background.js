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
      chrome.tabs.move(tabId, { index: index });
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

function moveTabToRight(tabId, ungroup = false) {
  const moveTab = (attempt = 0) => {
    chrome.tabs.move(tabId, { index: -1 }, () => {
      if (chrome.runtime.lastError) {
        console.log(`Move attempt ${attempt + 1} failed: ${chrome.runtime.lastError.message}`);
        if (attempt < 3) {  // Try up to 3 times
          setTimeout(() => moveTab(attempt + 1), 200);  // Wait 200ms before retrying
        } else {
          console.log("Failed to move tab after 3 attempts");
        }
      } else {
        console.log("Tab moved successfully");
        if (ungroup) {
          chrome.tabs.ungroup(tabId, () => {
            if (chrome.runtime.lastError) {
              console.error("Error ungrouping tab:", chrome.runtime.lastError);
            } else {
              console.log("Tab ungrouped successfully");
            }
          });
        }
      }
    });
  };

  moveTab();
}

function showPopup() {
  console.log("Showing popup");
  // chrome.windows.create({
  //   url: 'popup.html',
  //   type: 'popup',
  //   width: 300,
  //   height: 200
  // });
}

let lastActivatedTime = 0;
const DEBOUNCE_TIME = 50; // milliseconds

let archiveGroupId = null;

function manageArchiveGroup(activeTabId) {
  chrome.tabs.query({ currentWindow: true }, (tabs) => {
    // Sort tabs by last accessed time, most recent first
    tabs.sort((a, b) => b.lastAccessed - a.lastAccessed);

    // Find or create the archive group
    if (!archiveGroupId) {
      chrome.tabGroups.query({ title: "Archive" }, (groups) => {
        if (groups.length > 0) {
          archiveGroupId = groups[0].id;
          processArchive(tabs, activeTabId);
        } else if (tabs.length > 5) {  // Only create archive if there are more than 5 tabs
          chrome.tabs.group({ tabIds: [tabs[5].id] }, (groupId) => {
            chrome.tabGroups.update(groupId, { title: "Archive", collapsed: true }, () => {
              archiveGroupId = groupId;
              moveArchiveGroupToLeft();
              processArchive(tabs, activeTabId);
            });
          });
        }
      });
    } else {
      processArchive(tabs, activeTabId);
    }
  });
}

function moveArchiveGroupToLeft() {
  if (archiveGroupId !== null) {
    chrome.tabGroups.move(archiveGroupId, { index: 0 }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error moving Archive group:", chrome.runtime.lastError);
      } else {
        console.log("Archive group moved to the left");
      }
    });
  }
}

function processArchive(tabs, activeTabId) {
  const recentTabs = tabs.slice(0, 5).map(tab => tab.id);
  const tabsToArchive = tabs.slice(5)
    .map(tab => tab.id)
    .filter(id => id !== activeTabId && !recentTabs.includes(id));

  // Move tabs to archive
  if (tabsToArchive.length > 0) {
    chrome.tabs.query({ groupId: archiveGroupId }, (existingArchivedTabs) => {
      const existingArchivedTabIds = existingArchivedTabs.map(tab => tab.id);
      const newTabsToArchive = tabsToArchive.filter(id => !existingArchivedTabIds.includes(id));

      if (newTabsToArchive.length > 0) {
        chrome.tabs.group({ tabIds: newTabsToArchive, groupId: archiveGroupId }, () => {
          if (chrome.runtime.lastError) {
            console.error("Error grouping tabs:", chrome.runtime.lastError);
          } else {
            chrome.tabGroups.update(archiveGroupId, { collapsed: true }, () => {
              moveArchiveGroupToLeft();
            });
          }
        });
      } else {
        moveArchiveGroupToLeft();
      }
    });
  } else {
    moveArchiveGroupToLeft();
  }

  // Remove recent tabs from archive
  chrome.tabs.query({ groupId: archiveGroupId }, (archivedTabs) => {
    const tabsToRemoveFromArchive = archivedTabs
      .filter(tab => recentTabs.includes(tab.id))
      .map(tab => tab.id);

    if (tabsToRemoveFromArchive.length > 0) {
      chrome.tabs.ungroup(tabsToRemoveFromArchive, () => {
        if (chrome.runtime.lastError) {
          console.error("Error ungrouping tabs:", chrome.runtime.lastError);
        } else {
          moveArchiveGroupToLeft();
        }
      });
    }
  });
}

function setupTabListeners() {
  chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      if (tab.groupId === archiveGroupId) {
        moveTabToRight(activeInfo.tabId, true);
      } else {
        moveTabToRight(activeInfo.tabId);
      }
      manageArchiveGroup(activeInfo.tabId);
      const now = Date.now();
      if (now - lastActivatedTime > DEBOUNCE_TIME) {
        showPopup();
      }
      lastActivatedTime = now;
    });
  });

  chrome.tabs.onHighlighted.addListener((highlightInfo) => {
    const tabId = highlightInfo.tabIds[0];
    chrome.tabs.get(tabId, (tab) => {
      if (tab.groupId === archiveGroupId) {
        moveTabToRight(tabId, true);
      } else {
        moveTabToRight(tabId);
      }
      manageArchiveGroup(tabId);
      const now = Date.now();
      if (now - lastActivatedTime > DEBOUNCE_TIME) {
        showPopup();
      }
      lastActivatedTime = now;
    });
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      if (tab.groupId === archiveGroupId) {
        moveTabToRight(tabId, true);
      } else {
        moveTabToRight(tabId);
      }
      manageArchiveGroup(tabId);
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

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  manageArchiveGroup(null);
});

chrome.tabGroups.onMoved.addListener((group) => {
  if (group.id === archiveGroupId) {
    moveArchiveGroupToLeft();
  }
});
chrome.tabGroups.onUpdated.addListener((group) => {
  if (group.id === archiveGroupId && !group.collapsed) {
    // User has expanded the archive group
    console.log("Archive group expanded by user");
    // You can add any additional actions here if needed
  }
});