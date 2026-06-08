(async () => {
  // --- Page Context Detection ---
  const isPdf = location.href.toLowerCase().includes(".pdf");
  const isLocal = location.href.startsWith("file://");
  const shouldShowFloatingButton = isPdf && !isLocal;

  // --- Core Data Parsing Methods ---
  function buildLines(items) {
    const rows = {};
    items.forEach((item) => {
      const y = Math.round(item.transform[5]);
      if (!rows[y]) rows[y] = [];
      rows[y].push({ text: item.str, x: item.transform[4] });
    });

    const sortedY = Object.keys(rows)
      .map(Number)
      .sort((a, b) => b - a);

    return sortedY
      .map((y) => {
        const row = rows[y];
        row.sort((a, b) => a.x - b.x);
        return row
          .map((x) => x.text)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
      })
      .filter(Boolean);
  }

  function buildJson(lines) {
    const data = {
      contract: {},
      buyer: {},
      seller: {},
      paying_authority: {},
      product: {},
    };
    let currentBlock = "contract";
    let blocks = {
      contract: [],
      buyer: [],
      seller: [],
      paying_authority: [],
      product: [],
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("Buyer Details")) currentBlock = "buyer";
      else if (line.includes("Seller Details")) currentBlock = "seller";
      else if (line.includes("Paying Authority Details"))
        currentBlock = "paying_authority";
      else if (
        line.includes("Product Details") ||
        line.includes("Product Name")
      )
        currentBlock = "product";
      blocks[currentBlock].push(line);
    }

    const getVal = (blockLines, regex) => {
      for (let line of blockLines) {
        const match = line.match(regex);
        if (match && match[1]) return match[1].trim();
      }
      return "";
    };

    data.contract.contract_no = getVal(lines, /Contract No.*?:\s*(GEMC-\d+)/i);
    data.contract.generated_date = getVal(
      lines,
      /Generated Date\s*:\s*([0-9A-Za-z\-]+)/i
    );

    data.seller.gem_seller_id = getVal(
      blocks.seller,
      /GeM Seller ID\s*:\s*([A-Za-z0-9]+)/i
    );
    data.seller.company_name = getVal(
      blocks.seller,
      /Company Name\s*:\s*(.+?)(?=\||$)/i
    );
    data.seller.contact_no = getVal(
      blocks.seller,
      /Contact No\.\s*:\s*([0-9\-\+]+)/i
    );
    data.seller.email_id = getVal(
      blocks.seller,
      /Email ID\s*:\s*([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4})/i
    );
    data.seller.msme_registration_number = getVal(
      blocks.seller,
      /MSME Registration number\s*:\s*([A-Za-z0-9\-]+)/i
    );
    data.seller.gstin = getVal(
      blocks.seller,
      /GSTIN\s*:\s*([A-Za-z0-9\-\(\)\s,]+?)(?=\||$)/i
    );
    data.seller.gender = getVal(blocks.seller, /MSE Gender\s*:\s*([A-Za-z]+)/i);

    let sellerAddr = [];
    let capSeller = false;
    for (let line of blocks.seller) {
      if (line.match(/Address\s*:/i)) {
        capSeller = true;
        let text = line.replace(/.*Address\s*:/i, "").trim();
        if (text) sellerAddr.push(text);
      } else if (capSeller) {
        if (
          /(Email ID|Contact No|Company Name|GeM Seller ID|GSTIN|MSME Registration|MSE Gender)/i.test(
            line
          )
        ) {
          capSeller = false;
        } else {
          sellerAddr.push(line.trim());
        }
      }
    }
    const fullSellerAddr = sellerAddr.join(" ").replace(/\s+/g, " ");
    data.seller.address = fullSellerAddr;
    const pinMatch = fullSellerAddr.match(/\b\d{6}\b/);
    if (pinMatch) data.seller.pincode = pinMatch[0];

    data.buyer.department = getVal(
      blocks.buyer,
      /Department\s*:\s*(.+?)(?=\||$|ईमेल)/i
    );
    data.buyer.contact_no = getVal(
      blocks.buyer,
      /Contact No\.\s*:\s*([0-9\-\+]+)/i
    );
    data.buyer.email_id = getVal(
      blocks.buyer,
      /Email ID\s*:\s*([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4})/i
    );
    data.buyer.gstin = getVal(
      blocks.buyer,
      /GSTIN\s*:\s*([A-Za-z0-9\-\(\)\s,]+?)(?=\||$)/i
    );

    let buyerAddr = [];
    let capBuyer = false;
    for (let line of blocks.buyer) {
      if (line.match(/Address\s*:/i)) {
        capBuyer = true;
        let text = line.replace(/.*Address\s*:/i, "").trim();
        if (text) buyerAddr.push(text);
      } else if (capBuyer) {
        if (/(Email ID|Contact No|Department|Organisation|GSTIN)/i.test(line))
          capBuyer = false;
        else buyerAddr.push(line.trim());
      }
    }
    data.buyer.address = buyerAddr.join(" ").replace(/\s+/g, " ");

    data.paying_authority.contact_no = getVal(
      blocks.paying_authority,
      /Contact No\.\s*:\s*([0-9\-\+]+)/i
    );
    data.paying_authority.email_id = getVal(
      blocks.paying_authority,
      /Email ID\s*:\s*([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4})/i
    );
    data.paying_authority.designation = getVal(
      blocks.paying_authority,
      /Designation\s*:\s*(.+?)(?=\||$)/i
    );

    let payAddr = [];
    let capPay = false;
    for (let line of blocks.paying_authority) {
      if (line.match(/Address\s*:/i)) {
        capPay = true;
        let text = line.replace(/.*Address\s*:/i, "").trim();
        if (text) payAddr.push(text);
      } else if (capPay) {
        if (/(Email ID|Contact No|Designation)/i.test(line)) capPay = false;
        else payAddr.push(line.trim());
      }
    }
    data.paying_authority.address = payAddr.join(" ").replace(/\s+/g, " ");

    data.product.name = getVal(lines, /Product Name\s*:\s*(.+?)(?=\||$)/i);
    data.product.brand = getVal(lines, /Brand\s*:\s*(.+?)(?=\||$)/i);
    data.product.model = getVal(lines, /Model\s*:\s*(.+?)(?=\||$)/i);
    data.product.hsn_code = getVal(lines, /HSN Code\s*:\s*(\d+)/i);

    data.lines = lines;
    return data;
  }

  // --- BUFFER PIPELINE ---
  async function parseAndCopyBuffer(buffer, statusCallback) {
    try {
      statusCallback("PROCESSING...", "#d97706", null);
      const pdfjsLib = await import(chrome.runtime.getURL("libs/pdf.mjs"));
      pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
        "libs/pdf.worker.mjs"
      );

      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      let allLines = [];
      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
        const page = await pdf.getPage(pageNo);
        const content = await page.getTextContent();
        allLines.push(...buildLines(content.items));
      }

      const extractedData = buildJson(allLines);
      const json = JSON.stringify(extractedData, null, 2);
      await navigator.clipboard.writeText(json);

      // Pass the extracted data back to the UI to generate phone buttons
      statusCallback("COPIED TO CLIPBOARD!", "#16a34a", extractedData);
    } catch (error) {
      console.error(error);
      statusCallback("ERROR!", "#dc2626", null);
    }
  }

  async function fetchCurrentPdfBuffer() {
    const res = await fetch(location.href);
    return await res.arrayBuffer();
  }

  // --- Helper to extract and format the phone number safely ---
  function renderActionButtons(dataObj, container, btnStyles) {
    container.innerHTML = ""; // Clear old buttons

    const rawPhone =
      dataObj.seller?.contact_no ||
      dataObj.buyer?.contact_no ||
      dataObj.buyer?.phone ||
      "";
    const cleanNum = rawPhone.replace(/\D/g, "").slice(-10); // Keep last 10 digits

    if (cleanNum && cleanNum.length === 10) {
      // Create Call Button
      const callBtn = document.createElement("button");
      callBtn.innerHTML = "📞 Call";
      Object.assign(callBtn.style, btnStyles, { background: "#0ea5e9" }); // Blue
      callBtn.onclick = () => (window.location.href = `tel:${cleanNum}`);

      // Create WhatsApp Button
      const waBtn = document.createElement("button");
      waBtn.innerHTML = "💬 WhatsApp";
      Object.assign(waBtn.style, btnStyles, { background: "#25d366" }); // Green
      waBtn.onclick = () =>
        window.open(`https://wa.me/+91${cleanNum}`, "_blank");

      container.appendChild(callBtn);
      container.appendChild(waBtn);
    }
  }

  // ==========================================
  // SYSTEM 1: FLOATING BUTTON (Only Online PDFs)
  // ==========================================
  function injectFloatingButton() {
    if (
      !shouldShowFloatingButton ||
      document.getElementById("pdf-float-container")
    )
      return;

    // Outer Container to hold Convert, Call, and WhatsApp stacked vertically
    const floatContainer = document.createElement("div");
    floatContainer.id = "pdf-float-container";
    Object.assign(floatContainer.style, {
      position: "fixed",
      bottom: "25px",
      right: "25px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      zIndex: "2147483647",
      alignItems: "flex-end",
    });

    // Action Buttons Container (Hidden until conversion)
    const actionContainer = document.createElement("div");
    Object.assign(actionContainer.style, { display: "flex", gap: "10px" });

    // Main Convert Button
    const floatBtn = document.createElement("button");
    Object.assign(floatBtn.style, {
      width: "150px",
      height: "52px",
      background: "#2563eb",
      color: "white",
      border: "none",
      borderRadius: "10px",
      cursor: "pointer",
      fontWeight: "bold",
      fontSize: "12px",
      fontFamily: "Arial, sans-serif",
      boxShadow: "0 6px 16px rgba(0,0,0,0.3)",
      textAlign: "center",
      transition: "background 0.2s",
    });
    floatBtn.innerHTML = "CONVERT TO JSON";

    floatBtn.onclick = async () => {
      try {
        const buffer = await fetchCurrentPdfBuffer();
        await parseAndCopyBuffer(buffer, (text, color, dataObj) => {
          floatBtn.innerHTML = text;
          floatBtn.style.background = color;

          if (dataObj && text === "COPIED TO CLIPBOARD!") {
            const btnStyle = {
              width: "110px",
              height: "40px",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "12px",
              fontFamily: "Arial, sans-serif",
              boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
            };
            renderActionButtons(dataObj, actionContainer, btnStyle);
          }

          if (text === "COPIED TO CLIPBOARD!" || text === "ERROR!") {
            setTimeout(() => {
              floatBtn.innerHTML = "CONVERT TO JSON";
              floatBtn.style.background = "#2563eb";
            }, 4000);
          }
        });
      } catch (e) {
        floatBtn.innerHTML = "ERROR";
        floatBtn.style.background = "#dc2626";
        setTimeout(() => {
          floatBtn.innerHTML = "CONVERT TO JSON";
          floatBtn.style.background = "#2563eb";
        }, 3000);
      }
    };

    floatContainer.appendChild(actionContainer);
    floatContainer.appendChild(floatBtn);
    document.documentElement.appendChild(floatContainer);
  }

  // ==========================================
  // SYSTEM 2: UNIVERSAL DRAG & DROP MODAL
  // ==========================================
  let modalOverlay = null;

  function createDragDropModal() {
    modalOverlay = document.createElement("div");
    Object.assign(modalOverlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      backdropFilter: "blur(4px)",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "2147483647",
      fontFamily: "Arial, sans-serif",
    });

    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) toggleModal();
    });

    const modalBox = document.createElement("div");
    Object.assign(modalBox.style, {
      width: "400px",
      background: "#1e293b",
      borderRadius: "16px",
      boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
      padding: "24px",
      display: "flex",
      flexDirection: "column",
      position: "relative",
    });

    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "✖";
    Object.assign(closeBtn.style, {
      position: "absolute",
      top: "16px",
      right: "16px",
      background: "transparent",
      border: "none",
      color: "#94a3b8",
      fontSize: "16px",
      cursor: "pointer",
    });
    closeBtn.onclick = toggleModal;
    modalBox.appendChild(closeBtn);

    const title = document.createElement("h2");
    title.innerHTML = "PDF to JSON Extractor";
    Object.assign(title.style, {
      color: "#f8fafc",
      margin: "0 0 8px 0",
      fontSize: "18px",
      textAlign: "center",
    });
    modalBox.appendChild(title);

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".pdf";
    fileInput.style.display = "none";
    fileInput.addEventListener("change", (e) =>
      handleDroppedFile(e.target.files[0])
    );

    const dropZone = document.createElement("div");
    Object.assign(dropZone.style, {
      width: "100%",
      height: "160px",
      border: "2px dashed #475569",
      borderRadius: "12px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(30, 41, 59, 0.5)",
      cursor: "pointer",
      transition: "all 0.2s",
      boxSizing: "border-box",
      marginTop: "10px",
    });

    const statusText = document.createElement("div");
    statusText.innerHTML = "Drop PDF here or click to browse";
    Object.assign(statusText.style, {
      color: "#94a3b8",
      fontSize: "13px",
      marginTop: "12px",
      fontWeight: "bold",
    });

    const icon = document.createElement("div");
    icon.innerHTML = "📄";
    icon.style.fontSize = "40px";

    dropZone.appendChild(icon);
    dropZone.appendChild(statusText);
    dropZone.onclick = () => fileInput.click();

    // Container for generated Call/WA buttons
    const actionContainer = document.createElement("div");
    Object.assign(actionContainer.style, {
      display: "flex",
      gap: "10px",
      justifyContent: "center",
      marginTop: "15px",
    });

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }
    ["dragenter", "dragover", "dragleave", "drop"].forEach((ev) => {
      dropZone.addEventListener(ev, preventDefaults, false);
      modalOverlay.addEventListener(ev, preventDefaults, false);
    });

    dropZone.addEventListener("dragover", () => {
      dropZone.style.borderColor = "#3b82f6";
      dropZone.style.backgroundColor = "rgba(59, 130, 246, 0.1)";
    });

    dropZone.addEventListener("dragleave", () => {
      dropZone.style.borderColor = "#475569";
      dropZone.style.backgroundColor = "rgba(30, 41, 59, 0.5)";
    });

    dropZone.addEventListener("drop", (e) => {
      dropZone.style.borderColor = "#475569";
      dropZone.style.backgroundColor = "rgba(30, 41, 59, 0.5)";
      handleDroppedFile(e.dataTransfer.files[0]);
    });

    function handleDroppedFile(file) {
      if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
        alert("Please drop a valid PDF document.");
        return;
      }
      actionContainer.innerHTML = ""; // Reset buttons

      const reader = new FileReader();
      reader.onload = async (event) => {
        await parseAndCopyBuffer(
          event.target.result,
          (text, color, dataObj) => {
            statusText.innerHTML = text;
            statusText.style.color = color;

            if (dataObj && text === "COPIED TO CLIPBOARD!") {
              const btnStyle = {
                flex: 1,
                height: "45px",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "13px",
                fontFamily: "Arial, sans-serif",
              };
              renderActionButtons(dataObj, actionContainer, btnStyle);
            }

            if (text === "COPIED TO CLIPBOARD!" || text === "ERROR!") {
              setTimeout(() => {
                statusText.innerHTML = "Drop PDF here or click to browse";
                statusText.style.color = "#94a3b8";
              }, 4000);
            }
          }
        );
      };
      reader.readAsArrayBuffer(file);
    }

    modalBox.appendChild(dropZone);
    modalBox.appendChild(actionContainer);
    modalBox.appendChild(fileInput);

    const footerText = document.createElement("div");
    footerText.innerHTML = "Press <b>Ctrl+Shift+Y</b> or <b>Esc</b> to close";
    Object.assign(footerText.style, {
      color: "#64748b",
      fontSize: "11px",
      textAlign: "center",
      marginTop: "16px",
    });
    modalBox.appendChild(footerText);

    modalOverlay.appendChild(modalBox);
    document.documentElement.appendChild(modalOverlay);
  }

  function toggleModal() {
    if (!modalOverlay) createDragDropModal();
    modalOverlay.style.display =
      modalOverlay.style.display === "none" ? "flex" : "none";
  }

  // ==========================================
  // INJECTORS AND EVENT LISTENERS
  // ==========================================
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    injectFloatingButton();
  } else {
    document.addEventListener("DOMContentLoaded", injectFloatingButton);
    window.addEventListener("load", injectFloatingButton);
  }

  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "toggle-ui") toggleModal();
  });

  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      modalOverlay &&
      modalOverlay.style.display === "flex"
    ) {
      toggleModal();
    }
  });
})();
