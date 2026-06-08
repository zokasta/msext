import * as pdfjsLib from "./libs/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("libs/pdf.worker.mjs");

function buildLines(items) {
  const rows = {};
  items.forEach((item) => {
    const y = Math.round(item.transform[5]);
    if (!rows[y]) rows[y] = [];
    rows[y].push({ text: item.str, x: item.transform[4] });
  });

  return Object.values(rows)
    .map((row) => {
      row.sort((a, b) => a.x - b.x);
      return row
        .map((x) => x.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    })
    .filter(Boolean);
}

function getValue(lines, label) {
  const line = lines.find((x) => x.includes(label));
  if (!line) return "";
  const parts = line.split(":");
  if (parts.length < 2) return "";
  return parts.slice(1).join(":").trim();
}

function buildJson(lines) {
  const data = { contract: {}, buyer: {}, seller: {}, product: {} };
  
  data.contract.contract_no = getValue(lines, "Contract No");
  data.contract.generated_date = getValue(lines, "Generated Date");
  data.buyer.phone = getValue(lines, "Contact No.");
  data.buyer.email = getValue(lines, "Email ID");
  data.seller.gstin = getValue(lines, "GSTIN");

  const sellerIndex = lines.findIndex((x) => x.includes("Seller Details"));
  if (sellerIndex >= 0) {
    for (let i = sellerIndex; i < sellerIndex + 30 && i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("Company Name")) data.seller.company_name = line.split(":").pop().trim();
      if (line.includes("GeM Seller ID")) data.seller.gem_seller_id = line.split(":").pop().trim();
    }
  }

  const productIndex = lines.findIndex((x) => x.includes("Product Name"));
  if (productIndex >= 0) {
    data.product.name = lines[productIndex];
    const brandLine = lines.find((x) => x.includes("Brand :"));
    if (brandLine) data.product.brand = brandLine.split(":").pop().trim();
    const modelLine = lines.find((x) => x.includes("Model:"));
    if (modelLine) data.product.model = modelLine.split(":").pop().trim();
  }

  data.lines = lines;
  return data;
}

async function processPdfBuffer(buffer) {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let allLines = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const lines = buildLines(content.items);
    allLines.push(...lines);
  }
  const result = buildJson(allLines);
  return JSON.stringify(result, null, 2);
}

function updateStatus(text, className) {
  const statusEl = document.getElementById("status");
  statusEl.textContent = text;
  statusEl.className = `status-msg ${className}`;
}

function getPdfBuffer(url) {
  return new Promise((resolve, reject) => {
    if (url.startsWith("file://")) {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.responseType = "arraybuffer";
      xhr.onload = function () {
        if (xhr.status === 200 || xhr.status === 0) {
          resolve(xhr.response);
        } else {
          reject(new Error("Local file read execution failed."));
        }
      };
      xhr.onerror = () => reject(new Error("Local file access configuration missing. Check instructions."));
      xhr.send();
    } else {
      fetch(url)
        .then(res => {
          if (!res.ok) throw new Error("Network request failed");
          return res.arrayBuffer();
        })
        .then(resolve)
        .catch(reject);
    }
  });
}

// Option 1: Scrape Active Document
document.getElementById("extractBtn").addEventListener("click", async () => {
  updateStatus("Reading PDF...", "loading");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) throw new Error("Could not target an active browser window.");
    if (!tab.url.toLowerCase().includes(".pdf")) throw new Error("Target browser tab does not contain a PDF.");

    const buffer = await getPdfBuffer(tab.url);
    const json = await processPdfBuffer(buffer);
    
    await navigator.clipboard.writeText(json);
    updateStatus("Copied JSON Data!", "success");
  } catch (err) {
    updateStatus(err.message, "error");
  }
});

// Option 2: Fallback Manual Selection Frame
document.getElementById("fileInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  updateStatus("Reading Uploaded PDF...", "loading");
  try {
    const reader = new FileReader();
    reader.onload = async function () {
      try {
        const json = await processPdfBuffer(this.result);
        await navigator.clipboard.writeText(json);
        updateStatus("Copied Local JSON Data!", "success");
      } catch (err) {
        updateStatus(err.message, "error");
      }
    };
    reader.readAsArrayBuffer(file);
  } catch (err) {
    updateStatus(err.message, "error");
  }
});