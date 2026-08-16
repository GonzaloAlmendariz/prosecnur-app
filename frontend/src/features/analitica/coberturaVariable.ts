import type { DataReviewVariable } from "../../api/client";

// Vara V4: el motor de `data-review` entrega `n_missing` por variable y la
// tarjeta sólo leía `n_non_missing`. «1241 con dato» no dice de cuántos, y
// —peor— **tres situaciones distintas terminaban escribiendo el mismo
// «0 con dato»**:
//
//   · `whynotconsent` (acnur_acg): está en la base y llegó entera vacía.
//   · `SPACE_nolabel` (acnur_pdm): está en el formulario y NO llegó en la base.
//   · `D1_information` (acnur_acg): es un select_multiple que llega repartido
//     en sus dummies, así que su columna madre no existe. No es un problema.
//
// Las dos primeras son decisiones que el analista debería tomar —y ambas
// entran incluidas por defecto—; la tercera es el funcionamiento normal. El
// motor ya las distingue: cuando la columna no existe devuelve `0/0`, y cuando
// existe vacía devuelve `0/n`. Sólo faltaba leerlo.

export type EstadoCobertura = "normal" | "vacia" | "ausente" | "expandida";

export type Cobertura = {
  estado: EstadoCobertura;
  /** Fragmento de cobertura para la línea de metadatos de la tarjeta. */
  texto: string;
  /** Marca visible; `null` cuando el estado no pide que el analista decida. */
  aviso: { etiqueta: string; detalle: string } | null;
};

export function describirCobertura(
  variable: Pick<DataReviewVariable, "n_non_missing" | "n_missing">,
  tieneDummies = false,
): Cobertura {
  const conDato = Math.max(0, variable.n_non_missing ?? 0);
  const sinDato = Math.max(0, variable.n_missing ?? 0);
  const filas = conDato + sinDato;

  if (filas === 0) {
    // La columna no está en la data. Que sea normal o no depende de si su
    // contenido vive en otro sitio.
    return tieneDummies
      ? {
          estado: "expandida",
          texto: "llega repartida en sus opciones",
          aviso: null,
        }
      : {
          estado: "ausente",
          texto: "no llegó en la base",
          aviso: {
            etiqueta: "no está en la base",
            detalle:
              "Está declarada en el formulario pero su columna no llegó en los datos. Incluirla no aporta nada al reporte.",
          },
        };
  }

  if (conDato === 0) {
    return {
      estado: "vacia",
      texto: `0 de ${filas} con dato`,
      aviso: {
        etiqueta: "sin ningún dato",
        detalle: `Su columna llegó en la base pero las ${filas} filas están vacías. Incluirla no aporta nada al reporte.`,
      },
    };
  }

  return { estado: "normal", texto: `${conDato} de ${filas} con dato`, aviso: null };
}

/** Nombres de variable cuyo contenido llega repartido en columnas dummy. */
export function padresConDummies(variables: readonly DataReviewVariable[]): Set<string> {
  const padres = new Set<string>();
  for (const variable of variables) {
    const padre = variable.dummy_parent?.trim();
    if (padre) padres.add(padre);
  }
  return padres;
}
