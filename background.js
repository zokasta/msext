chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-pdf-extractor") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        if (
          tabs[0].url.startsWith("chrome://") ||
          tabs[0].url.startsWith("chrome-extension://")
        ) {
          return; // Extensions cannot run on internal Chrome settings pages
        }
        chrome.tabs
          .sendMessage(tabs[0].id, { action: "toggle-ui" })
          .catch(() => {});
      }
    });
  }
});
