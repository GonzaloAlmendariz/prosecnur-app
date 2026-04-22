// =============================================================================
// preload.cjs — bridge seguro entre el renderer (React) y el main (Node)
// =============================================================================
// El renderer corre con sandbox + contextIsolation + nodeIntegration=false,
// así que no puede usar APIs de Electron/Node directamente. Este preload
// expone una superficie mínima vía `contextBridge.exposeInMainWorld`:
//
//   window.prosecnurApi.openProjectDialog()
//   window.prosecnurApi.saveProjectDialog(defaultName)
//   window.prosecnurApi.saveEntregableDialog({ defaultName, filters })
//   window.prosecnurApi.getRecentProjects()
//   window.prosecnurApi.pushRecentProject(path)
//   window.prosecnurApi.onMenuCommand(callback)  // recibe 'project:save' etc.
//
// Cada función es un wrapper de `ipcRenderer.invoke('handler', args)` que
// el main resuelve con `ipcMain.handle('handler', ...)`. Patrón
// idiomático Electron 28+.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("prosecnurApi", {
  // ----- Diálogos de archivo --------------------------------------------------

  // Abre el dialog "Open" filtrado a *.pulso. Devuelve un path absoluto o
  // null si el user cancela.
  openProjectDialog: () => ipcRenderer.invoke("project:openDialog"),

  // Abre el dialog "Save" para un nuevo .pulso. defaultName se usa como
  // sugerencia (sin extensión — el filter agrega .pulso).
  saveProjectDialog: (defaultName) =>
    ipcRenderer.invoke("project:saveDialog", { defaultName }),

  // Dialog "Save" para un entregable cualquiera (codebook, reporte, etc.).
  // opts: { defaultName, defaultPath, filters: [{name, extensions[]}] }
  saveEntregableDialog: (opts) =>
    ipcRenderer.invoke("project:saveEntregableDialog", opts || {}),

  // ----- Recientes ------------------------------------------------------------

  // Devuelve un array de hasta 5 paths absolutos a .pulso recientes.
  getRecentProjects: () => ipcRenderer.invoke("project:getRecent"),

  // Agrega/promueve un path en la lista de recientes (lo mueve al top).
  pushRecentProject: (path) =>
    ipcRenderer.invoke("project:pushRecent", { path }),

  // ----- Eventos del menú nativo (main → renderer) ----------------------------

  // Suscribe a comandos del menú "Archivo" del main process. callback
  // recibe el nombre del comando, ej. "project:save", "project:open",
  // "project:new", "project:saveAs", "project:close".
  onMenuCommand: (callback) => {
    const handler = (_event, command) => callback(command);
    ipcRenderer.on("menu:command", handler);
    // Devolver un cleanup function para useEffect.
    return () => ipcRenderer.removeListener("menu:command", handler);
  }
});
