// Entrada pública de «Listas de opciones» (H7) para el editor.
export { ListasOpcionesDialog, type ListasOpcionesDialogProps } from "./ListasOpcionesDialog";
export { ListasOpcionesPanel, TEXTO_DIDACTICO_LISTAS } from "./ListasOpcionesPanel";
export { useListasOpciones, type ControlListasOpciones } from "./useListasOpciones";
export { useListasOpcionesPanel } from "./useListasOpcionesPanel";
export { PANEL_LISTAS_OPCIONES, estadoListasRepetidas } from "./panelListas";
export {
  analizarListas,
  contarEscalasRepetidas,
  renombrarLista,
  unificarListas,
  validarNombreLista,
  type AnalisisListas,
  type GrupoListasRepetidas,
  type ListaOpciones,
  type OpcionLista,
} from "./listasModel";
export {
  compararListasEntreFormularios,
  type ComparacionEntreFormularios,
  type FormularioHermano,
} from "./listasEntreFormularios";
export type { FormulariosDelProyecto } from "./useFormulariosHermanos";
