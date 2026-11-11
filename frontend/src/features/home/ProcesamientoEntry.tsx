// Entrada del módulo Procesamiento (`/procesamiento`).
//
// Hasta la etapa P2 del ADR 0142 este archivo era un `<Navigate>`: mandaba a la
// primera sección sin hacer. Desde la decisión D7 la ruta muestra "Estado del
// estudio", y la regla del redirect pasó a ser el botón de "Qué sigue"
// (`seccionQueSigue`, en features/procesamiento/estado/queSigueModel.ts).
//
// El archivo se conserva como punto de entrada porque `app/App.tsx` y
// `app/warmupRegistry.ts` cargan el módulo por esta ruta.
export { default } from "../procesamiento/estado/EstadoDelEstudioPage";
