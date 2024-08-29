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
  console.log("Remove Duplicates button clicked");
  chrome.runtime.sendMessage({ action: 'removeDuplicates' }, (response) => {
    console.log("Received response:", response);
    if (chrome.runtime.lastError) {
      console.error("Chrome runtime error:", chrome.runtime.lastError);
      alert("A Chrome runtime error occurred. Please check the console for details.");
      return;
    }
    if (!response) {
      console.error("No response received");
      alert("No response received from the background script. Please check the console for details.");
      return;
    }
    if (response.error) {
      console.error("Error from background script:", response.error);
      alert(response.error);
    } else if (response.message) {
      console.log("Message from background script:", response.message);
      alert(response.message);
    } else if (response.domain && response.count) {
      const message = `Do you want to close all ${response.count} tabs from ${response.domain}?`;
      if (confirm(message)) {
        chrome.runtime.sendMessage({ action: 'closeTabs', tabIds: response.tabIds }, (closeResponse) => {
          if (chrome.runtime.lastError) {
            console.error("Chrome runtime error during tab closure:", chrome.runtime.lastError);
            alert("An error occurred while closing tabs. Please check the console for details.");
          } else {
            console.log("Tabs closed:", closeResponse);
            alert(closeResponse.message);
          }
          window.close();
        });
      } else {
        console.log("User chose not to close tabs");
        window.close();
      }
    } else {
      console.error("Unexpected response structure:", response);
      alert("An unexpected response was received. Please check the console for details.");
    }
  });
});

document.getElementById('clearBrowsingData').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'clearBrowsingDataOfCurrentTabDomain' }, () => {
    window.close();
  });
});