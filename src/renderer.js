import { createIcons, icons } from "lucide";

createIcons({
  icons,
  attrs: {
    "stroke-width": 1.5,
    class: "lucide-icon",
  },
});

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const statusCoords = document.getElementById("status-coords");
const statusSize = document.getElementById("status-size");

// State
let currentTool = "pencil";
let isDrawing = false;
let startX, startY;
let snapshot; // To save canvas state for shape preview
let brushSize = 2;
let color1 = "#000000"; // Foreground
let color2 = "#FFFFFF"; // Background
let activeColorSlot = 1; // 1 or 2
let clipboard = null; // For copy/paste
let selectRect = null; // Selection rectangle {x, y, w, h}

// DOM Elements
const tools = document.querySelectorAll(".tool-icon");
const shapeTools = document.querySelectorAll(".shape-tool");
const sizeBtn = document.getElementById("size-menu-btn");
const sizeInput = document.getElementById("size");
const color1Box = document.getElementById("color1-box");
const color2Box = document.getElementById("color2-box");
const color1Preview = document.getElementById("color1-preview");
const color2Preview = document.getElementById("color2-preview");
const colorSwatches = document.querySelectorAll(".color-swatch");
const editColorsBtn = document.getElementById("edit-colors-btn");
const colorPicker = document.getElementById("colorPicker");

// Initialize
ctx.fillStyle = "white";
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.lineCap = "round";
ctx.lineJoin = "round";
updateStatusCoords(0, 0);

// --- Tool Selection ---
function setActiveTool(toolId) {
  currentTool = toolId;

  // Update UI
  tools.forEach((t) => t.classList.remove("active"));
  shapeTools.forEach((t) => t.classList.remove("active"));

  const toolBtn = document.getElementById(toolId);
  if (toolBtn) toolBtn.classList.add("active");
}

tools.forEach((tool) => {
  tool.addEventListener("click", () => setActiveTool(tool.id));
});

shapeTools.forEach((tool) => {
  tool.addEventListener("click", () => setActiveTool(tool.id));
});

// --- Size Control ---
sizeBtn.addEventListener("click", () => {
  // Simple toggle for now, ideally a dropdown
  sizeInput.style.display =
    sizeInput.style.display === "none" ? "block" : "none";
});

sizeInput.addEventListener("input", (e) => {
  brushSize = parseInt(e.target.value);
});

// --- Color Management ---
function updateColorPreviews() {
  color1Preview.style.backgroundColor = color1;
  color2Preview.style.backgroundColor = color2;
}

color1Box.addEventListener("click", () => {
  activeColorSlot = 1;
  color1Box.classList.add("active");
  color2Box.classList.remove("active");
});

color2Box.addEventListener("click", () => {
  activeColorSlot = 2;
  color2Box.classList.add("active");
  color1Box.classList.remove("active");
});

colorSwatches.forEach((swatch) => {
  swatch.addEventListener("click", (e) => {
    const color = swatch.dataset.color;
    if (activeColorSlot === 1) {
      color1 = color;
    } else {
      color2 = color;
    }
    updateColorPreviews();
  });

  // Right click to set background color directly
  swatch.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    color2 = swatch.dataset.color;
    updateColorPreviews();
  });
});

editColorsBtn.addEventListener("click", () => {
  colorPicker.click();
});

colorPicker.addEventListener("input", (e) => {
  if (activeColorSlot === 1) {
    color1 = e.target.value;
  } else {
    color2 = e.target.value;
  }
  updateColorPreviews();
});

// --- History (Undo/Redo) ---
const history = [];
let historyStep = -1;

function saveState() {
  historyStep++;
  if (historyStep < history.length) {
    history.length = historyStep; // Truncate future
  }
  history.push(canvas.toDataURL());
  // Limit history size
  if (history.length > 20) {
    history.shift();
    historyStep--;
  }
}

function undo() {
  if (historyStep > 0) {
    historyStep--;
    restoreState();
  }
}

function redo() {
  if (historyStep < history.length - 1) {
    historyStep++;
    restoreState();
  }
}

function restoreState() {
  const img = new Image();
  img.src = history[historyStep];
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  };
}

// Initialize history
saveState();

document.getElementById("undo-btn").addEventListener("click", undo);
document.getElementById("redo-btn").addEventListener("click", redo);
document.getElementById("save-btn").addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "untitled.png";
  link.href = canvas.toDataURL();
  link.click();
});

// --- Clipboard Functions ---
document.getElementById("copy-btn").addEventListener("click", () => {
  if (selectRect) {
    // Copy selected area
    clipboard = ctx.getImageData(
      selectRect.x,
      selectRect.y,
      selectRect.w,
      selectRect.h
    );
  } else {
    // Copy entire canvas
    clipboard = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
});

document.getElementById("cut-btn").addEventListener("click", () => {
  if (selectRect) {
    // Cut selected area
    clipboard = ctx.getImageData(
      selectRect.x,
      selectRect.y,
      selectRect.w,
      selectRect.h
    );
    // Clear the selection
    ctx.clearRect(selectRect.x, selectRect.y, selectRect.w, selectRect.h);
    ctx.fillStyle = "white";
    ctx.fillRect(selectRect.x, selectRect.y, selectRect.w, selectRect.h);
    saveState();
    selectRect = null;
  }
});

document.getElementById("paste-btn").addEventListener("click", () => {
  if (clipboard) {
    // Paste at center
    const x = (canvas.width - clipboard.width) / 2;
    const y = (canvas.height - clipboard.height) / 2;
    ctx.putImageData(clipboard, x, y);
    saveState();
  }
});

// --- Drawing Logic ---

canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseout", stopDrawing);

function startDrawing(e) {
  isDrawing = true;
  startX = e.offsetX;
  startY = e.offsetY;

  ctx.lineWidth = brushSize;
  ctx.strokeStyle = color1;
  ctx.fillStyle = color2; // For shapes with fill

  // Save canvas state for shape preview
  snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);

  if (currentTool === "fill") {
    floodFill(startX, startY, hexToRgb(color1));
    saveState(); // Save after fill
    isDrawing = false;
  } else if (currentTool === "eyedropper") {
    pickColor(startX, startY);
    isDrawing = false;
  } else if (currentTool === "select") {
    // Selection tool starts a selection rectangle
    selectRect = { x: startX, y: startY, w: 0, h: 0 };
  } else if (
    currentTool === "pencil" ||
    currentTool === "brush" ||
    currentTool === "eraser"
  ) {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
  }
}

function draw(e) {
  updateStatusCoords(e.offsetX, e.offsetY);

  if (!isDrawing) return;

  if (currentTool === "pencil" || currentTool === "brush") {
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
  } else if (currentTool === "eraser") {
    ctx.strokeStyle = "white"; // Eraser paints white
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
    ctx.strokeStyle = color1; // Restore
  } else if (currentTool === "select") {
    // Update selection rectangle
    selectRect.w = e.offsetX - startX;
    selectRect.h = e.offsetY - startY;

    // Draw selection preview
    ctx.putImageData(snapshot, 0, 0);
    ctx.strokeStyle = "#1e90ff";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(selectRect.x, selectRect.y, selectRect.w, selectRect.h);
    ctx.setLineDash([]);
  } else {
    // Shape tools: Restore snapshot then draw new shape
    ctx.putImageData(snapshot, 0, 0);
    drawShape(e.offsetX, e.offsetY);
  }
}

function stopDrawing(e) {
  if (!isDrawing) return;
  isDrawing = false;

  // Final draw for shapes to commit them
  if (
    currentTool !== "pencil" &&
    currentTool !== "brush" &&
    currentTool !== "eraser" &&
    currentTool !== "fill" &&
    currentTool !== "eyedropper" &&
    currentTool !== "select"
  ) {
    drawShape(e.offsetX, e.offsetY);
  } else if (currentTool === "select") {
    // Finalize selection rectangle - normalize negative dimensions
    if (selectRect.w < 0) {
      selectRect.x += selectRect.w;
      selectRect.w = -selectRect.w;
    }
    if (selectRect.h < 0) {
      selectRect.y += selectRect.h;
      selectRect.h = -selectRect.h;
    }
  }

  ctx.beginPath(); // Reset path
  saveState(); // Save state after drawing
}

function drawShape(x, y) {
  ctx.beginPath();

  if (currentTool === "line") {
    ctx.moveTo(startX, startY);
    ctx.lineTo(x, y);
    ctx.stroke();
  } else if (currentTool === "rectangle") {
    ctx.strokeRect(startX, startY, x - startX, y - startY);
  } else if (currentTool === "circle") {
    let radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
    ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
    ctx.stroke();
  } else if (currentTool === "triangle") {
    ctx.moveTo(startX, y);
    ctx.lineTo(x, y);
    ctx.lineTo((startX + x) / 2, startY);
    ctx.closePath();
    ctx.stroke();
  } else if (currentTool === "rounded-rect") {
    // Simple rounded rect approximation
    let w = x - startX;
    let h = y - startY;
    let r = 10;
    if (w < 0) w = -w;
    if (h < 0) h = -h;

    if (ctx.roundRect) {
      ctx.roundRect(startX, startY, x - startX, y - startY, 10);
    } else {
      ctx.rect(startX, startY, x - startX, y - startY);
    }
    ctx.stroke();
  }
}

// --- Helper Functions ---

function updateStatusCoords(x, y) {
  statusCoords.textContent = `${x}, ${y}px`;
}

function pickColor(x, y) {
  const pixel = ctx.getImageData(x, y, 1, 1).data;
  const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);

  if (activeColorSlot === 1) {
    color1 = hex;
  } else {
    color2 = hex;
  }
  updateColorPreviews();

  // Switch back to pencil after picking
  setActiveTool("pencil");
}

function floodFill(startX, startY, fillColor) {
  // Get image data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Get color at start position
  const startPos = (startY * canvas.width + startX) * 4;
  const startR = data[startPos];
  const startG = data[startPos + 1];
  const startB = data[startPos + 2];
  const startA = data[startPos + 3];

  // Don't fill if color is same
  if (
    startR === fillColor[0] &&
    startG === fillColor[1] &&
    startB === fillColor[2]
  )
    return;

  const stack = [[startX, startY]];

  while (stack.length) {
    const [x, y] = stack.pop();
    const pos = (y * canvas.width + x) * 4;

    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;

    if (
      data[pos] === startR &&
      data[pos + 1] === startG &&
      data[pos + 2] === startB
    ) {
      data[pos] = fillColor[0];
      data[pos + 1] = fillColor[1];
      data[pos + 2] = fillColor[2];
      data[pos + 3] = 255;

      stack.push([x + 1, y]);
      stack.push([x - 1, y]);
      stack.push([x, y + 1]);
      stack.push([x, y - 1]);
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [0, 0, 0];
}

function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// --- Tab Switching ---
const tabs = document.querySelectorAll(".tab");
const tabContents = document.querySelectorAll(".tab-content");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    // Deactivate all
    tabs.forEach((t) => t.classList.remove("active"));
    tabContents.forEach((c) => {
      c.style.display = "none";
      c.classList.remove("active");
    });

    // Activate clicked
    tab.classList.add("active");
    const tabName = tab.textContent.trim().toLowerCase();
    const content = document.getElementById(`${tabName}-tab-content`);
    if (content) {
      content.style.display = "flex";
      content.classList.add("active");
    }
  });
});

// --- Brushes Dropdown ---
const brushBtn = document.getElementById("brush");
const brushesDropdown = document.getElementById("brushes-dropdown");

if (brushBtn && brushesDropdown) {
  brushBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isVisible = brushesDropdown.style.display === "block";
    brushesDropdown.style.display = isVisible ? "none" : "block";
    setActiveTool("brush"); // Also select the tool
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!brushBtn.contains(e.target) && !brushesDropdown.contains(e.target)) {
      brushesDropdown.style.display = "none";
    }
  });

  // Handle dropdown items
  brushesDropdown.querySelectorAll(".dropdown-item").forEach((item) => {
    item.addEventListener("click", () => {
      // Here we could change brush style
      brushesDropdown.style.display = "none";
      setActiveTool("brush");
    });
  });
}

// --- Zoom Logic ---
let zoomLevel = 1;
const statusZoom = document.getElementById("status-zoom");

function updateZoom() {
  canvas.style.transform = `scale(${zoomLevel})`;
  canvas.style.transformOrigin = "top left";
  if (statusZoom) statusZoom.textContent = `${Math.round(zoomLevel * 100)}%`;
}

document.getElementById("zoom-in-btn")?.addEventListener("click", () => {
  zoomLevel += 0.25;
  updateZoom();
});

document.getElementById("zoom-out-btn")?.addEventListener("click", () => {
  if (zoomLevel > 0.25) {
    zoomLevel -= 0.25;
    updateZoom();
  }
});

document.getElementById("reset-zoom-btn")?.addEventListener("click", () => {
  zoomLevel = 1;
  updateZoom();
});
