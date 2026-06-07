chrome.runtime.onInstalled.addListener(() => {
  console.log("Tender PDF Extractor Loaded");
});

chrome.commands.onCommand.addListener(async (command) => {

  if (command !== "extract-pdf") {
      return;
  }

  const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
  });

  if (!tab?.id) {
      return;
  }

  chrome.tabs.sendMessage(
      tab.id,
      {
          action: "extractPdf"
      }
  );
});

chrome.runtime.onMessage.addListener(
  async (message, sender, sendResponse) => {

      if (message.action === "copyJson") {

          try {

              await navigator.clipboard.writeText(
                  message.json
              );

              sendResponse({
                  success: true
              });

          } catch (error) {

              sendResponse({
                  success: false,
                  error: error.message
              });
          }

          return true;
      }
  }
);