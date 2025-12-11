

// === 1. User Input + Live Data from Backend ===
let responseData = null;
let selectedSymptoms = [];
let allSymptoms = [];
let dropdownHighlight = -1;

// Fetch symptoms list from backend and populate datalist
async function fetchSymptoms() {
  try {
    const res = await fetch("http://localhost:5000/symptoms");
    if (!res.ok) throw new Error("Could not fetch symptoms");
    const list = await res.json();
    allSymptoms = Array.isArray(list) ? list : [];
    return allSymptoms;
  } catch (err) {
    console.error("Error fetching symptoms", err);
    allSymptoms = [];
    return [];
  }
}

// Initialize symptom input / chips UI
function setupSymptomInput() {
  const input = document.getElementById("symptom-input");
  const chipsDiv = document.getElementById("symptom-chips");
  let dropdown = document.getElementById("symptom-dropdown");
  // Render dropdown as a portal attached to document.body so it can position
  // reliably regardless of surrounding layout/scrolling.
  if (dropdown && dropdown.parentElement !== document.body) {
    // detach from its current parent and append to body
    document.body.appendChild(dropdown);
  }

  function addChip(value) {
    if (!value) return;
    value = value.trim().toLowerCase();
    if (value === "" || selectedSymptoms.includes(value)) return;
    selectedSymptoms.push(value);
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = value;
    const rm = document.createElement("button");
    rm.textContent = "×";
    rm.onclick = () => {
      selectedSymptoms = selectedSymptoms.filter((s) => s !== value);
      try {
        chipsDiv.removeChild(chip);
      } catch (e) {}
      updateSavedSymptomsPanel();
    };
    chip.appendChild(rm);
    chipsDiv.appendChild(chip);
    updateSavedSymptomsPanel();
  }

  function renderDropdown(items, highlightIndex = -1) {
    dropdown.innerHTML = "";
    dropdown.style.opacity = "1";

    if (!items || items.length === 0) {
      dropdown.style.display = "none";
      dropdown.setAttribute("aria-hidden", "true");
      return;
    }
    items.forEach((it, idx) => {
      const div = document.createElement("div");
      div.className =
        "symptom-item" + (idx === highlightIndex ? " highlight" : "");
      div.textContent = it;
      div.dataset.value = it;
      div.addEventListener("mousedown", (ev) => {
        // mousedown to prevent blur before click
        ev.preventDefault();
        addChip(it);
        input.value = "";
        hideDropdown();
      });
      dropdown.appendChild(div);
    });
    dropdown.style.display = "block";
    dropdown.setAttribute("aria-hidden", "false");
    positionDropdownUnderInput();

    // Ensure charts / summary section are pushed down so dropdown does not
    // overlap them. We store original margin and restore it when dropdown
    // is hidden.
    try {
      const summary = document.querySelector(".summary-section");
      if (summary) {
        if (summary._originalMarginTop === undefined) {
          const cm = window.getComputedStyle(summary);
          summary._originalMarginTop = parseInt(cm.marginTop) || 0;
        }
        // Use dropdown's rendered height (cap already in CSS/positioning)
        const ddHeight = Math.min(
          dropdown.scrollHeight || dropdown.offsetHeight || 0,
          320
        );
        // Add some breathing room (20px)
        summary.style.marginTop = ddHeight + 20 + "px";
      }
    } catch (e) {
      // swallow errors (non-critical)
    }
  }

  function hideDropdown() {
    dropdown.style.opacity = "0";

    dropdown.style.display = "none";
    dropdown.setAttribute("aria-hidden", "true");
    dropdownHighlight = -1;
    try {
      const summary = document.querySelector(".summary-section");
      if (summary && summary._originalMarginTop !== undefined) {
        summary.style.marginTop = summary._originalMarginTop + "px";
      }
    } catch (e) {}
  }

  function positionDropdownUnderInput() {
    if (!dropdown || !input) return;
    // measure input position and set dropdown coords (account for scroll)
    const rect = input.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    // prefer placing below input; if not enough space, place above
    const top = rect.bottom + scrollY + 6; // 6px gap
    const left = rect.left + scrollX;
    dropdown.style.position = "absolute";
    // set explicit positioning and sizing to avoid inherited CSS like left:0/right:0
    dropdown.style.left = left + "px";
    dropdown.style.right = "auto";
    dropdown.style.top = top + "px";
    dropdown.style.width = rect.width + "px"; // match input width
    dropdown.style.minWidth = Math.min(rect.width, 300) + "px";
    dropdown.style.maxWidth = Math.max(300, rect.width) + "px";
    // explicitly cap height so it never fills the whole page
    dropdown.style.maxHeight = "300px";
    dropdown.style.overflowY = "auto";
    dropdown.style.boxSizing = "border-box";
    dropdown.style.zIndex = 1200;
  }

  function showDropdownForQuery(q) {
    const query = (q || "").trim().toLowerCase();
   // Better search: prefix matches come first
const filtered = allSymptoms
  .filter(s => s && !selectedSymptoms.includes(s.toLowerCase()))
  .map(s => s.toLowerCase())
  .filter(s => s.includes(query))
  .sort((a, b) => {
    const aStart = a.startsWith(query);
    const bStart = b.startsWith(query);
    if (aStart && !bStart) return -1;
    if (!aStart && bStart) return 1;
    return a.localeCompare(b);
  })
  .slice(0, 50);

    renderDropdown(filtered, -1);
  }

  input.addEventListener("input", (ev) => {
    const q = input.value || "";
    showDropdownForQuery(q);
  });

  input.addEventListener("focus", (ev) => {
    showDropdownForQuery(input.value || "");
    // ensure dropdown positions correctly on focus
    positionDropdownUnderInput();
  });

  // keyboard navigation
  input.addEventListener("keydown", (ev) => {
    const visible = dropdown.style.display !== "none";
    const items = Array.from(dropdown.querySelectorAll(".symptom-item"));
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      if (!visible) showDropdownForQuery(input.value || "");
      dropdownHighlight = Math.min(dropdownHighlight + 1, items.length - 1);
      items.forEach((it, i) =>
        it.classList.toggle("highlight", i === dropdownHighlight)
      );
      return;
    }
    if (ev.key === "ArrowUp") {
      ev.preventDefault();
      dropdownHighlight = Math.max(dropdownHighlight - 1, 0);
      items.forEach((it, i) =>
        it.classList.toggle("highlight", i === dropdownHighlight)
      );
      return;
    }
    if (ev.key === "Enter") {
      if (visible && dropdownHighlight >= 0 && items[dropdownHighlight]) {
        ev.preventDefault();
        const val = items[dropdownHighlight].dataset.value;
        addChip(val);
        input.value = "";
        hideDropdown();
        return;
      }
      // fallback: add typed value
      if (input.value && input.value.trim() !== "") {
        ev.preventDefault();
        const val = input.value.replace(/,$/, "");
        input.value = "";
        addChip(val);
        hideDropdown();
      }
    }
    if (ev.key === ",") {
      ev.preventDefault();
      const val = input.value.replace(/,$/, "");
      input.value = "";
      addChip(val);
      hideDropdown();
    }
  });

  // allow pasting comma-separated
  input.addEventListener("paste", (ev) => {
    setTimeout(() => {
      const val = input.value;
      if (val.includes(",")) {
        val.split(",").forEach((v) => {
          addChip(v);
        });
        input.value = "";
        hideDropdown();
      }
    }, 50);
  });

  // hide when clicking outside
  document.addEventListener("click", (ev) => {
    // If click is outside input and outside dropdown, hide it
    if (
      ev.target !== input &&
      !dropdown.contains(ev.target) &&
      ev.target !== chipsDiv
    ) {
      hideDropdown();
    }
  });

  // reposition on scroll/resize so dropdown stays aligned
  window.addEventListener(
    "scroll",
    () => {
      if (dropdown.style.display === "block") positionDropdownUnderInput();
    },
    { passive: true }
  );
  window.addEventListener("resize", () => {
    if (dropdown.style.display === "block") positionDropdownUnderInput();
  });

  // Saved symptoms panel helpers
  function updateSavedSymptomsPanel() {
    const list = document.getElementById("saved-symptoms-list");
    if (!list) return;
    list.innerHTML = "";
    selectedSymptoms.forEach((s) => {
      const li = document.createElement("li");
      li.textContent = s;
      li.title = s;
      li.addEventListener("click", () => {
        selectedSymptoms = selectedSymptoms.filter((x) => x !== s);
        // remove matching chip element(s)
        const chips = Array.from(document.querySelectorAll(".chip"));
        chips.forEach((c) => {
          if (c.textContent && c.textContent.indexOf(s) !== -1) {
            try {
              c.remove();
            } catch (e) {}
          }
        });
        updateSavedSymptomsPanel();
      });
      list.appendChild(li);
    });
  }

  // Clear saved
  const clearBtn = document.getElementById("clear-saved-symptoms");
  if (clearBtn) {
    clearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      selectedSymptoms = [];
      // remove chips
      const chips = Array.from(document.querySelectorAll(".chip"));
      chips.forEach((c) => c.remove());
      updateSavedSymptomsPanel();
    });
  }
}

async function submitPrediction() {
  const age = document.getElementById("age-input").value;
  const payload = { symptoms: selectedSymptoms };
  if (age) payload.age = parseInt(age);
  // Require at least 4 symptoms before making a prediction
  if (!Array.isArray(selectedSymptoms) || selectedSymptoms.length < 4) {
    alert(
      "Please enter at least 4 symptoms before predicting to improve accuracy."
    );
    document.getElementById("symptom-input").focus();
    return;
  }
  try {
    const res = await fetch("http://localhost:5000/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let errMsg = "Prediction failed";
      try {
        const err = await res.json();
        errMsg = err.error || errMsg;
      } catch (e) {}
      alert("Error: " + errMsg);
      return;
    }
    responseData = await res.json();
    updateUIWithResponse(responseData);
  } catch (err) {
    console.error("Prediction error", err);
    alert("Prediction failed: " + err.message);
  }
}

function prepareProbabilityForChart(probStr) {
  // probStr like '46.32%'
  return parseFloat(String(probStr).replace("%", "")) || 0;
}

// Patient info helper
function getPatientInfo() {
  // Return age and India-formatted timestamp (DD MMM YYYY, HH:MM IST)
  const age = document.getElementById("age-input")?.value || "";
  const now = new Date();
  const indiaDate = now.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
  return {
    age: age,
    datetime_ist: indiaDate + " (IST)",
  };
}

// Download prescription as PDF (jsPDF) with a text fallback
function downloadPrescription(diseaseData, filename) {
  filename =
    filename ||
    `Prescription-${diseaseData.disease_name || "diagnosis"}-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/:/g, "-")}.pdf`;
  try {
    if (window.jspdf && window.jspdf.jsPDF) {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      // Clinic metadata (customize if desired)
      const clinic = {
        name: "MediScan Clinic",
        address: "Mumbai, Maharashtra, India",
        doctor: "Dr. A. Kumar",
        contact: "+91 98765 43210",
      };

      let y = 18;
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text(clinic.name, 14, y);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(clinic.address, 14, y + 6);
      doc.text(`Contact: ${clinic.contact}`, 14, y + 12);
      // separator
      doc.setDrawColor(200);
      doc.setLineWidth(0.4);
      doc.line(14, y + 18, 196, y + 18);
      y += 26;

      // Patient & visit info
      const p = getPatientInfo();
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Patient Details", 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(`Age: ${p.age || "N/A"}`, 150, y);
      y += 8;
      doc.text(`Visit Date/Time (IST): ${p.datetime_ist}`, 14, y);
      y += 10;

      // Diagnosis
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(`Diagnosis: ${diseaseData.disease_name || ""}`, 14, y);
      y += 8;
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`Severity: ${diseaseData.severity_level || "N/A"}`, 14, y);
      doc.text(`Risk Score: ${diseaseData.risk_score || "N/A"}`, 150, y);
      y += 10;

      // Description
      if (diseaseData.description) {
        const desc = doc.splitTextToSize(diseaseData.description, 180);
        doc.text(desc, 14, y);
        y += desc.length * 6 + 6;
      }

      // Medications
      if (diseaseData.medications && diseaseData.medications.length) {
        doc.setFont("helvetica", "bold");
        doc.text("Medications:", 14, y);
        y += 7;
        doc.setFont("helvetica", "normal");
        diseaseData.medications.forEach((m, idx) => {
          const lines = doc.splitTextToSize(`${idx + 1}. ${m}`, 180);
          doc.text(lines, 14, y);
          y += lines.length * 6;
        });
        y += 4;
      }

      // Precautions
      if (diseaseData.precautions && diseaseData.precautions.length) {
        doc.setFont("helvetica", "bold");
        doc.text("Precautions / Advice:", 14, y);
        y += 7;
        doc.setFont("helvetica", "normal");
        diseaseData.precautions.forEach((pc) => {
          const lines = doc.splitTextToSize(`- ${pc}`, 180);
          doc.text(lines, 14, y);
          y += lines.length * 6;
        });
        y += 6;
      }

      // Footer / signature
      const footerY = 280;
      doc.setDrawColor(220);
      doc.line(14, footerY - 20, 196, footerY - 20);
      doc.setFont("helvetica", "bold");
      doc.text(clinic.doctor, 140, footerY - 6);
      doc.setFont("helvetica", "normal");
      doc.text("Signature", 150, footerY + 2);

      doc.save(filename);
      return;
    }
  } catch (e) {
    console.warn("jsPDF generation failed, falling back to text download", e);
  }

  // Fallback: plain text file (no Patient ID per request)
  const p = getPatientInfo();
  let txt = `MediScan Prescription\n\nAge: ${p.age}\nVisit Date/Time (IST): ${
    p.datetime_ist
  }\n\nDiagnosis: ${diseaseData.disease_name || ""}\nSeverity: ${
    diseaseData.severity_level || ""
  }\nRisk Score: ${diseaseData.risk_score || ""}\n\nMedications:\n`;
  (diseaseData.medications || []).forEach((m) => (txt += `- ${m}\n`));
  txt += "\nPrecautions:\n";
  (diseaseData.precautions || []).forEach((pItem) => (txt += `- ${pItem}\n`));
  const blob = new Blob([txt], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (filename || "prescription.txt").replace(/\s+/g, "_");
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Helper function to normalize list fields
function normalizeListFieldSimple(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    // Try to parse JSON string
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // Not JSON, try splitting by commas or newlines
      return value
        .split(/[,;\n]/)
        .map(s => s.trim())
        .filter(Boolean);
    }
  }
  // If it's a single value, wrap it in an array
  return [String(value)];
}

function updateUIWithResponse(resultArray) {
  if (!Array.isArray(resultArray) || resultArray.length === 0) {
    alert("No predictions returned");
    return;
  }
  
  // Debug: Log the response data to see structure
  console.log('Response data:', JSON.stringify(resultArray, null, 2));
  
  // Update top, left, right columns
  const top = resultArray[0];
  const left = resultArray[1] || {};
  const right = resultArray[2] || {};

  // Primary
  document.getElementById("col-primary-name").textContent =
    top.disease_name || "Unknown";
  document.getElementById("col-primary-prob").textContent =
    top.probability || "0%";
  document.getElementById("col-primary-risk").textContent =
    top.risk_score || "0";
  document.getElementById("col-primary-severity").textContent =
    top.severity_level || "Unknown";
  document.getElementById("col-primary-emergency").textContent =
    top.emergency || "Unknown";
  document.getElementById("col-primary-surgery").textContent =
    top.surgery_needed || "Unknown";
  document.getElementById("col-primary-desc").textContent =
    top.description || "";
  const fillList = (id, list) => {
    const ul = document.getElementById(id);
    ul.innerHTML = "";
    (list || []).forEach((i) => {
      const li = document.createElement("li");
      li.textContent = i;
      ul.appendChild(li);
    });
  };
  
  // Primary column
  fillList("col-primary-precautions", top.precautions || []);
  fillList("col-primary-meds", top.medications || []);
  fillList("col-primary-diets", top.diets || []);
  fillList("col-primary-workouts", top.workouts || []);

  // Wire download button for primary
  try {
    const btnPrimary = document.getElementById("col-primary-download");
    if (btnPrimary) {
      btnPrimary.onclick = () =>
        downloadPrescription(
          (responseData && responseData[0]) || top,
          `Prescription - ${
            ((responseData && responseData[0]) || top).disease_name || "primary"
          }.pdf`
        );
    }
  } catch (e) {}

  // Secondary (left)
  document.getElementById("col-left-name").textContent =
    left.disease_name || "Unknown";
  document.getElementById("col-left-prob").textContent =
    left.probability || "0%";
  document.getElementById("col-left-risk").textContent = left.risk_score || "0";
  document.getElementById("col-left-severity").textContent =
    left.severity_level || "Unknown";
  document.getElementById("col-left-emergency").textContent =
    left.emergency || "Unknown";
  document.getElementById("col-left-desc").textContent = left.description || "";
  
  // Fixed: Use proper field access for left column
  fillList("col-left-precautions", left.precautions || []);
  fillList("col-left-meds", left.medications || []);
  fillList("col-left-diets", left.diets || []);
  fillList("col-left-workouts", left.workouts || []);

  // Wire download button for left
  try {
    const btnLeft = document.getElementById("col-left-download");
    if (btnLeft) {
      btnLeft.onclick = () =>
        downloadPrescription(
          (responseData && responseData[1]) || left,
          `Prescription - ${
            ((responseData && responseData[1]) || left).disease_name ||
            "secondary"
          }.pdf`
        );
    }
  } catch (e) {}

  // Tertiary (right)
  document.getElementById("col-right-name").textContent =
    right.disease_name || "Unknown";
  document.getElementById("col-right-prob").textContent =
    right.probability || "0%";
  document.getElementById("col-right-risk").textContent =
    right.risk_score || "0";
  document.getElementById("col-right-severity").textContent =
    right.severity_level || "Unknown";
  document.getElementById("col-right-emergency").textContent =
    right.emergency || "Unknown";
  document.getElementById("col-right-desc").textContent =
    right.description || "";
  
  // Fixed: Use proper field access for right column
  fillList("col-right-precautions", right.precautions || []);
  fillList("col-right-meds", right.medications || []);
  fillList("col-right-diets", right.diets || []);
  fillList("col-right-workouts", right.workouts || []);

  // Wire download button for right
  try {
    const btnRight = document.getElementById("col-right-download");
    if (btnRight) {
      btnRight.onclick = () =>
        downloadPrescription(
          (responseData && responseData[2]) || right,
          `Prescription - ${
            ((responseData && responseData[2]) || right).disease_name ||
            "tertiary"
          }.pdf`
        );
    }
  } catch (e) {}

  // Update charts: recreate the charts using amCharts 5
  try {
    if (window.probRoot) window.probRoot.dispose();
    if (window.riskRoot) window.riskRoot.dispose();
  } catch (e) {}

  // Build probability pie
  window.probRoot = am5.Root.new("probabilityChart");
  window.probRoot.setThemes([am5themes_Animated.new(window.probRoot)]);
  const probChart = window.probRoot.container.children.push(
    am5percent.PieChart.new(window.probRoot, {
      layout: window.probRoot.verticalLayout,
      innerRadius: am5.percent(40),
    })
  );
  const probSeries = probChart.series.push(
    am5percent.PieSeries.new(window.probRoot, {
      valueField: "value",
      categoryField: "disease",
      alignLabels: false,
    })
  );

  // FIX: Remove slice labels to avoid overlap
probSeries.labels.template.set("visible", false);
probSeries.ticks.template.set("visible", false);

  const pData = [top, left, right].filter(Boolean).map((item) => ({
    disease: item.disease_name,
    value: prepareProbabilityForChart(item.probability),
  }));
  probSeries.data.setAll(pData);
  const legend = probChart.children.push(
    am5.Legend.new(window.probRoot, {
      centerX: am5.percent(50),
      x: am5.percent(50),
      marginTop: 15,
      marginBottom: 15,
    })
  );
  legend.data.setAll(probSeries.dataItems);

  // Risk bar chart
  window.riskRoot = am5.Root.new("riskBarChart");
  window.riskRoot.setThemes([am5themes_Animated.new(window.riskRoot)]);
  const riskChart = window.riskRoot.container.children.push(
    am5xy.XYChart.new(window.riskRoot, {
      panX: false,
      panY: false,
      wheelX: "none",
      wheelY: "none",
      paddingLeft: 0,
      paddingRight: 20,
    })
  );
  const riskData = [top, left, right].filter(Boolean).map((i) => ({
    disease: i.disease_name,
    risk: i.risk_score,
    severity: i.severity_level,
    probability: i.probability,
  }));
  const yAxis = riskChart.yAxes.push(
    am5xy.ValueAxis.new(window.riskRoot, {
      min: 0,
      max: 100,
      strictMinMax: true,
      renderer: am5xy.AxisRendererY.new(window.riskRoot, {
        strokeOpacity: 0.1,
      }),
    })
  );
  const xAxis = riskChart.xAxes.push(
    am5xy.CategoryAxis.new(window.riskRoot, {
      categoryField: "disease",
     renderer: am5xy.AxisRendererX.new(window.riskRoot, {
    cellStartLocation: 0.1,
    cellEndLocation: 0.9,
    minGridDistance: 40,
    labels: {
        rotation: -20,        // tilt labels
        centerY: am5.p50,
        centerX: am5.p50,
        oversizedBehavior: "wrap"
    }
}),
    })
  );
  xAxis.data.setAll(riskData);
  const series = riskChart.series.push(
    am5xy.ColumnSeries.new(window.riskRoot, {
      name: "Risk Score",
      xAxis: xAxis,
      yAxis: yAxis,
      valueYField: "risk",
      categoryXField: "disease",
    })
  );
  series.columns.template.set(
    "tooltip",
    am5.Tooltip.new(window.riskRoot, {
      labelText:
        "Disease: {categoryX}\nRisk Score: {valueY}\nSeverity: {severity}\nProbability: {probability}",
      pointerOrientation: "horizontal",
    })
  );
  series.columns.template.adapters.add("fill", function (fill, target) {
    let r = target.dataItem.get("valueY");
    if (r >= 70) return am5.color(0xe74c3c);
    if (r >= 40) return am5.color(0xf39c12);
    return am5.color(0x2ecc71);
  });
  series.columns.template.adapters.add("stroke", function (stroke, target) {
    if (target.isHover) return am5.color(0x2c3e50);
    return stroke;
  });
  series.columns.template.set("strokeOpacity", 0);
  series.bullets.push(function () {
    return am5.Bullet.new(window.riskRoot, {
      locationY: 1,
      sprite: am5.Label.new(window.riskRoot, {
        text: "{valueY}",
        fill: am5.color(0x2c3e50),
        centerY: am5.p100,
        centerX: am5.p50,
        populateText: true,
        fontSize: 14,
        fontWeight: "600",
      }),
    });
  });
  series.data.setAll(riskData);
  try {
    if (series.dataItems && typeof series.dataItems.each === "function") {
      series.dataItems.each(function (dataItem) {
        var dataContext = dataItem.dataContext;
        dataItem.set("severity", dataContext.severity);
        dataItem.set("probability", dataContext.probability);
      });
    }
  } catch (e) {
    console.warn("Could not iterate dataItems to set extra fields:", e);
  }
  series.appear(1000);
  riskChart.appear(1000, 100);
}

// Initialize input handlers and default UI
(async function init() {
  const list = await fetchSymptoms();
  setupSymptomInput();
  document.getElementById("submit-btn").addEventListener("click", (e) => {
    e.preventDefault();
    submitPrediction();
  });

  // No dynamic positioning: layout handled by CSS. This avoids conflicts
  // where JS may move elements unexpectedly and cause overlap.
})();

// === 2. amCharts 5 Initialization (placeholder charts) ===
am5.ready(function () {
  // Placeholder probability pie (store root on window to avoid duplicates)
  if (window.probRoot) {
    try {
      window.probRoot.dispose();
    } catch (e) {}
  }
  window.probRoot = am5.Root.new("probabilityChart");
  var probRoot = window.probRoot;
  probRoot.setThemes([am5themes_Animated.new(probRoot)]);
  var probChart = probRoot.container.children.push(
    am5percent.PieChart.new(probRoot, {
      layout: probRoot.verticalLayout,
      innerRadius: am5.percent(40),
    })
  );
  var probSeries = probChart.series.push(
    am5percent.PieSeries.new(probRoot, {
      valueField: "value",
      categoryField: "disease",
      alignLabels: false,
    })
  );
  probSeries.slices.template.setAll({
    stroke: am5.color(0xffffff),
    strokeWidth: 2,
    templateField: "sliceSettings",
  });
  probSeries.labels.template.setAll({
    fontSize: 13,
    fontWeight: "500",
    text: "{category}: {valuePercentTotal.formatNumber('0.0')}%",
    fill: am5.color(0x2c3e50),
  });
  probSeries.ticks.template.set("visible", false);
  probSeries.data.setAll([]);
  var legend = probChart.children.push(
    am5.Legend.new(probRoot, {
      centerX: am5.percent(50),
      x: am5.percent(50),
      marginTop: 15,
      marginBottom: 15,
    })
  );
  legend.data.setAll(probSeries.dataItems);

  // Placeholder risk bar chart (store root on window to avoid duplicates)
  if (window.riskRoot) {
    try {
      window.riskRoot.dispose();
    } catch (e) {}
  }
  window.riskRoot = am5.Root.new("riskBarChart");
  var riskRoot = window.riskRoot;
  riskRoot.setThemes([am5themes_Animated.new(riskRoot)]);
  var riskChart = riskRoot.container.children.push(
    am5xy.XYChart.new(riskRoot, {
      panX: false,
      panY: false,
      wheelX: "none",
      wheelY: "none",
      paddingLeft: 0,
      paddingRight: 20,
    })
  );
  let riskData = [];
  var yAxis = riskChart.yAxes.push(
    am5xy.ValueAxis.new(riskRoot, {
      min: 0,
      max: 100,
      strictMinMax: true,
      renderer: am5xy.AxisRendererY.new(riskRoot, { strokeOpacity: 0.1 }),
    })
  );
  var xAxis = riskChart.xAxes.push(
    am5xy.CategoryAxis.new(riskRoot, {
      categoryField: "disease",
      renderer: am5xy.AxisRendererX.new(riskRoot, {
        cellStartLocation: 0.1,
        cellEndLocation: 0.9,
        minGridDistance: 30,
        label: { fontSize: 12, centerX: am5.p50 },
      }),
    })
  );
  xAxis.data.setAll(riskData);
  var series = riskChart.series.push(
    am5xy.ColumnSeries.new(riskRoot, {
      name: "Risk Score",
      xAxis: xAxis,
      yAxis: yAxis,
      valueYField: "risk",
      categoryXField: "disease",
    })
  );
  series.columns.template.set(
    "tooltip",
    am5.Tooltip.new(riskRoot, {
      labelText:
        "Disease: {categoryX}\nRisk Score: {valueY}\nSeverity: {severity}\nProbability: {probability}",
      pointerOrientation: "horizontal",
    })
  );
  series.columns.template.events.on("pointerover", function (ev) {
    var column = ev.target;
    column.animate({
      key: "scale",
      to: 1.1,
      duration: 200,
      easing: am5.ease.out(am5.ease.cubic),
    });
  });
  series.columns.template.events.on("pointerout", function (ev) {
    var column = ev.target;
    column.animate({
      key: "scale",
      to: 1,
      duration: 200,
      easing: am5.ease.out(am5.ease.cubic),
    });
  });
  series.columns.template.adapters.add("fill", function (fill, target) {
    let risk = target.dataItem.get("valueY");
    if (risk >= 70) {
      return am5.color(0xe74c3c);
    } else if (risk >= 40) {
      return am5.color(0xf39c12);
    }
    return am5.color(0x2ecc71);
  });
  series.columns.template.adapters.add("stroke", function (stroke, target) {
    if (target.isHover) {
      return am5.color(0x2c3e50);
    }
    return stroke;
  });
  series.columns.template.set("strokeOpacity", 0);
  series.bullets.push(function () {
    return am5.Bullet.new(riskRoot, {
      locationY: 1,
      sprite: am5.Label.new(riskRoot, {
        text: "{valueY}",
        fill: am5.color(0x2c3e50),
        centerY: am5.p100,
        centerX: am5.p50,
        populateText: true,
        fontSize: 14,
        fontWeight: "600",
      }),
    });
  });
  series.data.setAll(riskData);
  series.dataItems.each(function (dataItem) {
    var dataContext = dataItem.dataContext;
    dataItem.set("severity", dataContext.severity);
    dataItem.set("probability", dataContext.probability);
  });
  series.appear(1000);
  riskChart.appear(1000, 100);
});`  `