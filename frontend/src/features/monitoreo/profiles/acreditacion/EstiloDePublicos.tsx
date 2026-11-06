import { reglasDeColores } from "./paletaPublicos";

/**
 * La hoja con los colores que el equipo eligió para sus públicos (Modelo ›
 * Cuotas). Se monta una vez en el perfil: cada pieza ya lleva la clase propia
 * del público (`clasePublico`), así que cambiar un color no re-pinta a nadie.
 */
export function EstiloDePublicos({ colores }: { colores: Readonly<Record<string, string>> | null | undefined }) {
  const reglas = reglasDeColores(colores);
  return reglas ? <style data-publico-colores="">{reglas}</style> : null;
}
