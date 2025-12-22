// Preload script
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const { contextBridge, ipcRenderer } = require("electron");

// Expose a simple API
contextBridge.exposeInMainWorld("electronAPI", {
  // Add any APIs if needed, e.g., for file operations
});
