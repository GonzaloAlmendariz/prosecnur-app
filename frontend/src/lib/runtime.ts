// Detección de "modo público" para el deploy del Dashboard a la web.
//
// Cuando el bundle se construye con `VITE_PULSO_PUBLIC_MODE=true`, la
// SPA arranca solo con el Dashboard montado y oculta toda la UI admin
// (sidebar, configurador, modales de proyecto). El backend
// Plumber asociado expone únicamente endpoints read-only del dashboard
// (whitelist en `forbid_mutations.R`).
export function isPublicMode(): boolean {
  return import.meta.env.VITE_PULSO_PUBLIC_MODE === "true";
}
