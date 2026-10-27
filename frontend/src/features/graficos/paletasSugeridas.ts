// Paletas que el editor ofrece al analista cuando una lista todavía no tiene
// colores propios.
//
// Están aquí, y no dentro del componente, porque son una decisión editorial de
// la casa —qué color significa qué— y tienen que poder verificarse sin montar
// la UI. Ver `paletasSugeridas.test.ts`.
//
// LA REGLA QUE GOBIERNA ESTE ARCHIVO: en una escala ordinal el rojo no es un
// paso, es un juicio. El entregable aprobado de acreditación abre su rampa en
// naranja claro y el verificador del mazo lo exige (`rojo_en_rampa_max = 0`).
// Las paletas evaluativas de aquí abrían en `rojo`, así que cada proyecto nuevo
// nacía con el defecto y había que corregirlo lista por lista —23 en el mazo de
// Contabilidad—. Las CATEGÓRICAS tampoco lo llevan: el coral va sólo en los
// títulos y una lista sin orden toma la rampa de azules del estándar (Gonzalo,
// 2026-10-27: «manda el JSON»).

export type SugeridaPalette = {
  label: string;
  description: string;
  colors: string[];
  /** `true` cuando los colores representan un orden (peor → mejor). */
  ordinal?: boolean;
};

export type PaletasPorCantidad = Record<number, SugeridaPalette[]>;

export const PULSO_PUCP_COLORS = {
  azul: "#081F5C",
  rojo: "#CA5651",
  verde: "#85BB85",
  amarillo: "#EFD25E",
  gris: "#BFBFBF",
  naranja: "#E4A34C",
  azulSecundario: "#7594CC",
  morado: "#9688D3",
  grisSecundario: "#D8D8D8",
  blanco: "#FFFFFF",
  // Los dos pasos que la rampa ordinal necesita y la paleta categórica no
  // tenía. Medidos sobre el entregable aprobado de acreditación.
  naranjaSuave: "#F4B183",
  verdeClaro: "#B0D597",
  verdeIntenso: "#70AD47",
} as const;

// La rampa Likert del recetario (estandar_pulso.json, `likert` y `likert_neutro`): la misma que el motor pone por defecto a
// una escala sin paleta (graficador_paleta.R, `.graficos_paleta_likert`). Va aparte de los colores categóricos porque su
// amarillo y su verde son otros tonos. Gonzalo, 2026-10-09: «Por defecto, pero el usuairo aun tiene la posibilidad e
// selecionar su paleta».
export const LIKERT_RECETARIO = {
  desacuerdoFuerte: "#F4B183",
  desacuerdo: "#FFD965",
  neutro: "#D9D9D9",
  acuerdo: "#ADD493",
  acuerdoFuerte: "#70AD47",
  sinInformacion: "#BFBFBF",
  // Tres y seis pasos sin neutro: la interpolación de los cuatro de arriba, como el motor (colorRampPalette).
  rampa3: ["#F4B183", "#D6D67C", "#70AD47"],
  rampa6: ["#F4B183", "#FAC971", "#EED86E", "#BDD589", "#94C474", "#70AD47"],
} as const;
const L = LIKERT_RECETARIO;

/** El coral de la casa: va en los títulos, nunca en un dato (estandar_pulso.json, `reglas.coral`). */
export const ROJO_FUERA_DE_RAMPA = PULSO_PUCP_COLORS.rojo;

// Las paletas nominales del estándar (estandar_pulso.json, `paletas`), que es la constitución del motor: Gonzalo,
// 2026-10-27, «manda el JSON». Son las mismas que el motor pone a una lista sin paleta propia (`.std_paleta_nominal` en
// estandar_tokens.R) y las que pinta el catálogo del recetario; `paletasSugeridas.test.ts` las compara con el JSON.
export const ESTANDAR_NOMINAL = {
  dicotomica: ["#081F5C", "#9DC3E6"],
  // `categorica`; con seis y siete opciones, su interpolación de los cuatro azules (colorRampPalette del motor).
  categorica: ["#081F5C", "#4F7FAF", "#8E9DBD", "#B9C5DC", "#8A93A8"],
  categorica6: ["#081F5C", "#32588D", "#5B85B1", "#8197BA", "#9FADC9", "#B9C5DC"],
  categorica7: ["#081F5C", "#2B4F85", "#4F7FAF", "#6E8EB6", "#8E9DBD", "#A3B1CC", "#B9C5DC"],
  actores: ["#0B4F8C", "#2A9D8F", "#E9C46A", "#8E9DBD", "#081F5C", "#9DC3E6"],
} as const;
const N = ESTANDAR_NOMINAL;

/** La paleta nominal para `n` opciones, como `.std_paleta_nominal` del motor; vacía pasadas las siete (el motor interpola). */
export function paletaNominal(n: number): string[] {
  if (n > 7) return [];
  if (n <= 2) return [...N.dicotomica].slice(0, n);
  if (n <= 5) return N.categorica.slice(0, n);
  return n === 6 ? [...N.categorica6] : [...N.categorica7];
}

const AZULES = (n: number): SugeridaPalette => ({
  label: "Pulso azules", description: "Categorías sin orden: la rampa de azules del estándar, de la más a la menos elegida.", colors: paletaNominal(n),
});
const ACTORES = (n: number): SugeridaPalette => ({
  label: "Pulso públicos", description: "Un color por público que se conserva en todo el informe.", colors: N.actores.slice(0, n),
});

// La posición importa: la primera es la que completa una lista sin colores (`coloresParaCompletar`). Para cuatro
// opciones va primero la rampa Likert, como antes; para las demás, la nominal del estándar.
export const SUGERIDAS_PALETAS: PaletasPorCantidad = {
  2: [
    { label: "Pulso dicotómica", description: "Sí en azul oscuro y No en celeste, en todas las láminas.", colors: [...N.dicotomica] },
    { label: "Pulso aprobación", description: "Contraste directo para dos estados evaluativos.", ordinal: true, colors: [L.desacuerdoFuerte, L.acuerdoFuerte] },
    ACTORES(2),
  ],
  3: [
    AZULES(3),
    { label: "Pulso semáforo", description: "De insatisfecho a satisfecho, sin rojo de juicio.", ordinal: true, colors: [...L.rampa3] },
    ACTORES(3),
  ],
  4: [
    { label: "Pulso aprobación", description: "Rampa de cuatro pasos, de desacuerdo a acuerdo.", ordinal: true, colors: [L.desacuerdoFuerte, L.desacuerdo, L.acuerdo, L.acuerdoFuerte] },
    AZULES(4),
    ACTORES(4),
  ],
  5: [
    AZULES(5),
    { label: "Pulso Likert", description: "De desacuerdo a acuerdo, con gris para la categoría neutra.", ordinal: true, colors: [L.desacuerdoFuerte, L.desacuerdo, L.acuerdo, L.acuerdoFuerte, L.sinInformacion] },
    ACTORES(5),
  ],
  6: [
    AZULES(6),
    ACTORES(6),
    { label: "Pulso aprobación", description: "Cinco pasos con el neutro gris al centro y «Sin información» al final.", ordinal: true, colors: [L.desacuerdoFuerte, L.desacuerdo, L.neutro, L.acuerdo, L.acuerdoFuerte, L.sinInformacion] },
  ],
  7: [
    { label: "Pulso aprobación", description: "Seis pasos del extremo bajo al alto y «Sin información» al final.", ordinal: true, colors: [...L.rampa6, L.sinInformacion] },
    AZULES(7),
  ],
};
