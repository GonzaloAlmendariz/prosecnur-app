// Texto de la sección «Significancia estadística» de Cruces (P-A9). Las letras comparan las columnas de cada variable
// de cruce, par por par. La prueba, la corrección, el nivel, el umbral y la base mínima ya no se eligen aquí: los fija
// la regla del estudio (ADR 0126/0128, `graficos_config$significancia`), la misma de las láminas y el Word. Se resume
// en `CrucesReglaEstudio`. Nunca asteriscos ni chi².

export type ModoCruces = "estandar" | "dimensiones";

// La pestaña genera siempre con este nivel; el motor lo acepta configurable.
export const ALFA_CRUCES = 0.05;

export function formatoAlfa(alfa: number): string {
  return Number.isFinite(alfa) && alfa > 0 && alfa < 1 ? String(alfa) : String(ALFA_CRUCES);
}

export function subtituloSignificancia(): string {
  return "Compara las columnas de cada variable de cruce, par por par, y marca con letras las diferencias significativas.";
}

export function detalleSignificancia(modo: ModoCruces): string {
  const objeto = modo === "dimensiones" ? "ese promedio es mayor que el" : "esa proporción es mayor que la";
  return `Una letra en la celda indica que ${objeto} de la columna con esa letra. `
    + "La prueba, la corrección y el nivel son los de la regla del estudio.";
}
