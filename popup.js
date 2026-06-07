import * as pdfjsLib from "./libs/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
  "libs/pdf.worker.mjs"
);

const output = document.getElementById("output");

function buildLines(items) {
  const rows = {};

  items.forEach((item) => {
    const y = Math.round(item.transform[5]);

    if (!rows[y]) {
      rows[y] = [];
    }

    rows[y].push({
      text: item.str,
      x: item.transform[4],
    });
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

function extractValue(lines, label) {
  const line = lines.find((x) => x.toLowerCase().includes(label.toLowerCase()));

  if (!line) {
    return "";
  }

  const parts = line.split(":");

  return parts.length > 1 ? parts.slice(1).join(":").trim() : "";
}

function parseDocument(lines) {
  const result = {
    contract: {},

    buyer: {},

    seller: {},

    items: [],

    raw_lines: lines,
  };

  result.contract.contract_no = extractValue(lines, "Contract No");

  result.contract.generated_date = extractValue(lines, "Generated Date");

  result.contract.procurement_mode = extractValue(lines, "Procurement Mode");

  result.buyer.contact = extractValue(lines, "Contact No");

  result.buyer.email = extractValue(lines, "Email ID");

  result.seller.gstin = extractValue(lines, "GSTIN");

  const allText = lines.join("\n");

  const emails =
    allText.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi) || [];

  const phones = allText.match(/\b\d{10}\b/g) || [];

  result.emails = emails;
  result.phones = phones;

  return result;
}

document.getElementById("extractBtn").addEventListener("click", async () => {
  const file = document.getElementById("pdfFile").files[0];

  if (!file) {
    alert("Select PDF");

    return;
  }

  try {
    const buffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
      data: buffer,
    }).promise;

    let allLines = [];

    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page = await pdf.getPage(pageNo);

      const content = await page.getTextContent();

      const lines = buildLines(content.items);

      allLines.push(...lines);
    }

    const result = parseDocument(allLines);

    output.value = JSON.stringify(result, null, 2);
  } catch (error) {
    console.error(error);

    alert(error.message);
  }
});

document.getElementById("copyBtn").addEventListener("click", async () => {
  await navigator.clipboard.writeText(output.value);

  alert("JSON Copied");
});
