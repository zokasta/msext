(async () => {
  if (!location.href.toLowerCase().includes(".pdf")) {
    return;
  }

  function extractField(text, regex) {
    const match = text.match(regex);
    return match ? match[1].trim() : "";
  }

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

  function getValue(lines, label) {
    const line = lines.find((x) => x.includes(label));

    if (!line) {
      return "";
    }

    const parts = line.split(":");

    if (parts.length < 2) {
      return "";
    }

    return parts.slice(1).join(":").trim();
  }

  function buildJson(lines) {
    const data = {
      contract: {},

      buyer: {},

      seller: {},

      product: {},
    };

    data.contract.contract_no = getValue(lines, "Contract No");

    data.contract.generated_date = getValue(lines, "Generated Date");

    data.buyer.phone = getValue(lines, "Contact No.");

    data.buyer.email = getValue(lines, "Email ID");

    data.seller.gstin = getValue(lines, "GSTIN");

    const sellerIndex = lines.findIndex((x) => x.includes("Seller Details"));

    if (sellerIndex >= 0) {
      for (let i = sellerIndex; i < sellerIndex + 30 && i < lines.length; i++) {
        const line = lines[i];

        if (line.includes("Company Name")) {
          data.seller.company_name = line.split(":").pop().trim();
        }

        if (line.includes("GeM Seller ID")) {
          data.seller.gem_seller_id = line.split(":").pop().trim();
        }
      }
    }

    const productIndex = lines.findIndex((x) => x.includes("Product Name"));

    if (productIndex >= 0) {
      data.product.name = lines[productIndex];

      const brandLine = lines.find((x) => x.includes("Brand :"));

      if (brandLine) {
        data.product.brand = brandLine.split(":").pop().trim();
      }

      const modelLine = lines.find((x) => x.includes("Model:"));

      if (modelLine) {
        data.product.model = modelLine.split(":").pop().trim();
      }
    }

    data.lines = lines;

    return data;
  }

  console.log("PDF DETECTED");

  const button = document.createElement("button");

  button.innerHTML = "COPY JSON";

  Object.assign(button.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: "999999999",
    width: "120px",
    height: "50px",
    border: "none",
    borderRadius: "10px",
    background: "#2563eb",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
  });

  document.body.appendChild(button);

  button.onclick = async () => {
    try {
      button.innerHTML = "Loading";

      const pdfjsLib = await import(chrome.runtime.getURL("libs/pdf.mjs"));

      pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
        "libs/pdf.worker.mjs"
      );

      const response = await fetch(location.href);

      const buffer = await response.arrayBuffer();

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

      const result = buildJson(allLines);

      const json = JSON.stringify(result, null, 2);

      await navigator.clipboard.writeText(json);
      console.log(result);

      button.innerHTML = "Copied";

      setTimeout(() => {
        button.innerHTML = "COPY JSON";
      }, 3000);
    } catch (error) {
      console.error(error);

      button.innerHTML = "Error";

      alert(error.message);
    }
  };
})();
