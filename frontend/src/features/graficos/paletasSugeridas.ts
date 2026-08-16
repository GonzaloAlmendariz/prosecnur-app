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
// Contabilidad—. Las paletas CATEGÓRICAS son otra cosa: ahí el rojo es el color
// institucional distinguiendo series sin orden, y se queda.

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

/** El rojo institucional: legítimo en categóricas, prohibido en una rampa. */
export const ROJO_FUERA_DE_RAMPA = PULSO_PUCP_COLORS.rojo;

export const SUGERIDAS_PALETAS: PaletasPorCantidad = {
  2: [
    { label: "Pulso principal", description: "Azul institucional y rojo principal.", colors: [PULSO_PUCP_COLORS.azul, PULSO_PUCP_COLORS.rojo] },
    { label: "Pulso aprobación", description: "Contraste directo para dos estados evaluativos.", ordinal: true, colors: [PULSO_PUCP_COLORS.naranjaSuave, PULSO_PUCP_COLORS.verde] },
    { label: "Pulso neutro", description: "Azul institucional con gris para categorías de soporte.", colors: [PULSO_PUCP_COLORS.azul, PULSO_PUCP_COLORS.gris] },
  ],
  3: [
    { label: "Pulso principal", description: "Tres categorías con colores principales.", colors: [PULSO_PUCP_COLORS.azul, PULSO_PUCP_COLORS.rojo, PULSO_PUCP_COLORS.verde] },
    { label: "Pulso semáforo", description: "De insatisfecho a satisfecho, sin rojo de juicio.", ordinal: true, colors: [PULSO_PUCP_COLORS.naranjaSuave, PULSO_PUCP_COLORS.amarillo, PULSO_PUCP_COLORS.verde] },
    { label: "Pulso frecuencias", description: "Azules y gris para frecuencias o distribución.", colors: [PULSO_PUCP_COLORS.azul, PULSO_PUCP_COLORS.azulSecundario, PULSO_PUCP_COLORS.gris] },
  ],
  4: [
    { label: "Pulso aprobación", description: "La rampa de cuatro pasos del informe de acreditación.", ordinal: true, colors: [PULSO_PUCP_COLORS.naranjaSuave, PULSO_PUCP_COLORS.amarillo, PULSO_PUCP_COLORS.verdeClaro, PULSO_PUCP_COLORS.verde] },
    { label: "Pulso principal", description: "Cuatro categorías con fuerte presencia institucional.", colors: [PULSO_PUCP_COLORS.azul, PULSO_PUCP_COLORS.rojo, PULSO_PUCP_COLORS.verde, PULSO_PUCP_COLORS.amarillo] },
    { label: "Pulso secundarios", description: "Soporte para categorías adicionales sin repetir principales.", colors: [PULSO_PUCP_COLORS.naranja, PULSO_PUCP_COLORS.azulSecundario, PULSO_PUCP_COLORS.morado, PULSO_PUCP_COLORS.grisSecundario] },
  ],
  5: [
    { label: "Pulso principales", description: "La secuencia principal completa de la guía.", colors: [PULSO_PUCP_COLORS.azul, PULSO_PUCP_COLORS.rojo, PULSO_PUCP_COLORS.verde, PULSO_PUCP_COLORS.amarillo, PULSO_PUCP_COLORS.gris] },
    { label: "Pulso Likert", description: "De desacuerdo a acuerdo, con gris para la categoría neutra.", ordinal: true, colors: [PULSO_PUCP_COLORS.naranjaSuave, PULSO_PUCP_COLORS.amarillo, PULSO_PUCP_COLORS.verdeClaro, PULSO_PUCP_COLORS.verde, PULSO_PUCP_COLORS.gris] },
    { label: "Pulso secundarios", description: "Paleta secundaria para series o cortes extensos.", colors: [PULSO_PUCP_COLORS.naranja, PULSO_PUCP_COLORS.azulSecundario, PULSO_PUCP_COLORS.morado, PULSO_PUCP_COLORS.grisSecundario, PULSO_PUCP_COLORS.blanco] },
  ],
  6: [
    { label: "Pulso extendida", description: "Principales más naranja secundario.", colors: [PULSO_PUCP_COLORS.azul, PULSO_PUCP_COLORS.rojo, PULSO_PUCP_COLORS.verde, PULSO_PUCP_COLORS.amarillo, PULSO_PUCP_COLORS.gris, PULSO_PUCP_COLORS.naranja] },
    { label: "Pulso secundarios", description: "Categorías extra con secundarios y gris claro.", colors: [PULSO_PUCP_COLORS.naranja, PULSO_PUCP_COLORS.azulSecundario, PULSO_PUCP_COLORS.morado, PULSO_PUCP_COLORS.grisSecundario, PULSO_PUCP_COLORS.azul, PULSO_PUCP_COLORS.gris] },
    { label: "Pulso aprobación", description: "Escala evaluativa amplia con neutro al final.", ordinal: true, colors: [PULSO_PUCP_COLORS.naranjaSuave, PULSO_PUCP_COLORS.naranja, PULSO_PUCP_COLORS.amarillo, PULSO_PUCP_COLORS.verdeClaro, PULSO_PUCP_COLORS.verde, PULSO_PUCP_COLORS.gris] },
  ],
  7: [
    { label: "Pulso aprobación", description: "Escala de siete puntos, del extremo bajo al alto, con neutro al final.", ordinal: true, colors: [PULSO_PUCP_COLORS.naranjaSuave, PULSO_PUCP_COLORS.naranja, PULSO_PUCP_COLORS.amarillo, PULSO_PUCP_COLORS.verdeClaro, PULSO_PUCP_COLORS.verde, PULSO_PUCP_COLORS.verdeIntenso, PULSO_PUCP_COLORS.gris] },
    { label: "Pulso completa", description: "Principales y secundarios sin repetir blanco.", colors: [PULSO_PUCP_COLORS.azul, PULSO_PUCP_COLORS.rojo, PULSO_PUCP_COLORS.verde, PULSO_PUCP_COLORS.amarillo, PULSO_PUCP_COLORS.gris, PULSO_PUCP_COLORS.naranja, PULSO_PUCP_COLORS.azulSecundario] },
    { label: "Pulso extendida", description: "Incluye morado y gris claro para más cortes.", colors: [PULSO_PUCP_COLORS.azul, PULSO_PUCP_COLORS.rojo, PULSO_PUCP_COLORS.verde, PULSO_PUCP_COLORS.amarillo, PULSO_PUCP_COLORS.naranja, PULSO_PUCP_COLORS.azulSecundario, PULSO_PUCP_COLORS.morado] },
    { label: "Pulso neutra", description: "Más discreta para tablas y cortes con categorías auxiliares.", colors: [PULSO_PUCP_COLORS.azul, PULSO_PUCP_COLORS.azulSecundario, PULSO_PUCP_COLORS.gris, PULSO_PUCP_COLORS.grisSecundario, PULSO_PUCP_COLORS.naranja, PULSO_PUCP_COLORS.morado, PULSO_PUCP_COLORS.rojo] },
  ],
};
