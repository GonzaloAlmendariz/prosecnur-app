// Íconos de los tipos de lámina (F6.1b). Fuente: docs/qa/inventario-iconos-recetario-2026-10-10.md.
// - Los 22 tipos del recetario (capítulo 3) se dibujan desde las ranuras del estándar (ranurasEstandar.generated.ts)
//   más sus rasgos: punto de población en la cabecera, cifras, renglones de texto.
// - Las 8 de estructura (capítulo 1) se dibujan a mano en el mismo marco.
// - Las 3 de población «antiguas» derivan de su base + punto de población (sin dibujo nuevo).
// Las variantes (portada centrada/izquierda/banda, composiciones del índice, cierres…) no llevan ícono: se eligen en
// el inspector con miniaturas.

import { normalizarRanuras, type RanuraIcono } from "./geometriaLamina";
import { RANURAS_ESTANDAR } from "./ranurasEstandar.generated";
import {
  Acento, Bloque, Cifras, Circulo, LineasTexto, LineaTitulo, Marco, PuntoPoblacion, Trazo,
} from "./rasgosLamina";

export type OpcionesLamina = { ranuraActiva?: number };
type DibujoLamina = (o: OpcionesLamina) => JSX.Element;

/** Tipos con el ícono del público en la miniatura: ninguno desde 2026-10-14 (las láminas de población ya no lo llevan). */
const CON_POBLACION = new Set<string>();

/** Láminas de población antiguas del registro: su base del estándar + punto de población. */
export const ALIAS_LAMINA: Readonly<Record<string, string>> = {
  p_slide_2_graficos_poblacion: "p_slide_2_graficos",
  p_slide_3_graficos_poblacion: "p_slide_3_graficos_fila",
  p_slide_4_graficos_poblacion: "p_slide_4_graficos",
};

const NORMALIZADAS: ReadonlyMap<string, RanuraIcono[]> = new Map(
  Object.entries(RANURAS_ESTANDAR).map(([id, t]) => [id, normalizarRanuras(t.ranuras)]),
);

/**
 * Lámina del estándar. Acento único, por prioridad: ranura activa → cifras → punto de población → marco. Lo que
 * cede el acento queda en `currentColor`.
 */
function laminaEstandar(id: string, poblacion: boolean, { ranuraActiva }: OpcionesLamina): JSX.Element {
  const ranuras = NORMALIZADAS.get(id) ?? [];
  const graficos = ranuras.filter((r) => r.tipo === "grafico");
  const activa = ranuraActiva && ranuraActiva >= 1 && ranuraActiva <= graficos.length
    ? graficos[ranuraActiva - 1]
    : undefined;
  const cifrasAcento = !activa && ranuras.some((r) => r.tipo === "cifras");
  const puntoAcento = poblacion && !activa && !cifrasAcento;
  return (
    <>
      <Marco acento={!activa && !cifrasAcento && !puntoAcento} />
      <LineaTitulo />
      {ranuras.map((r, i) => {
        const clave = `${r.tipo}-${i}`;
        if (r.tipo === "texto") return <LineasTexto key={clave} r={r} />;
        if (r.tipo === "cifras") return <Cifras key={clave} r={r} acento={cifrasAcento} />;
        if (r === activa) {
          return <Acento key={clave}><Bloque x={r.x} y={r.y} w={r.w} h={r.h} tono="pleno" /></Acento>;
        }
        return <Bloque key={clave} x={r.x} y={r.y} w={r.w} h={r.h} />;
      })}
      {poblacion && (puntoAcento ? <Acento><PuntoPoblacion /></Acento> : <PuntoPoblacion />)}
    </>
  );
}

// ---- Estructura (a mano, mismo marco) ----

const portada: DibujoLamina = () => (
  <>
    <Marco />
    <Acento><Bloque x={3} y={9} w={12.75} h={3} tono="pleno" /></Acento>
    <Trazo d="M3 14.25H10.5" />
    <Bloque x={18} y={15.75} w={3} h={2.25} />
  </>
);

const indice: DibujoLamina = () => (
  <>
    <Marco />
    <LineaTitulo />
    <Acento><Trazo d="M3.75 10.5h0M3.75 13.5h0M3.75 16.5h0" tono="pleno" ancho={2.25} /></Acento>
    <Trazo d="M6.75 10.5H18M6.75 13.5H15.75M6.75 16.5H17.25" />
  </>
);

const seccion: DibujoLamina = () => (
  <>
    <Marco lleno />
    <Acento><Trazo d="M6.75 11.25H17.25" tono="pleno" ancho={2.25} /></Acento>
    <Trazo d="M9 14.25H15" />
  </>
);

/** Barra apilada de cinco puntos; los dos de arriba en acento, bajo una llave. */
const topTwoBox: DibujoLamina = () => (
  <>
    <Marco />
    <LineaTitulo />
    <Bloque x={3} y={13.5} w={3.75} h={3.75} />
    <Bloque x={8.25} y={13.5} w={2.25} h={3.75} />
    <Bloque x={12} y={13.5} w={1.5} h={3.75} tono="apoyo" />
    <Acento><Bloque x={15} y={13.5} w={6} h={3.75} tono="pleno" /></Acento>
    <Trazo d="M15 11.25V9.75H21V11.25" tono="pleno" />
  </>
);

/** Redondeo: «≈» (recetario p20–21: estándar y resto mayor). */
const redondeo: DibujoLamina = () => (
  <>
    <Marco />
    <LineaTitulo />
    <Acento>
      <Trazo tono="pleno" ancho={2.25}
        d="M7.5 12c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0M7.5 15.75c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0" />
    </Acento>
  </>
);

/** Objetivo del estudio: diana y renglones (recetario p26). */
const objetivo: DibujoLamina = () => (
  <>
    <Marco />
    <LineaTitulo />
    <Circulo cx={7.875} cy={13.5} r={3.75} hueco />
    <Acento><Circulo cx={7.875} cy={13.5} r={1.5} /></Acento>
    <Trazo d="M14.25 11.25H21M14.25 14.25H21M14.25 17.25H18" />
  </>
);

/** Ficha técnica: tabla de clave y valor (recetario p29). */
const fichaTecnica: DibujoLamina = () => (
  <>
    <Marco acento />
    <LineaTitulo />
    <Bloque x={3} y={9.75} w={4.5} h={1.5} />
    <Bloque x={3} y={12.75} w={4.5} h={1.5} />
    <Bloque x={3} y={15.75} w={4.5} h={1.5} />
    <Trazo d="M9.75 10.5H21M9.75 13.5H18.75M9.75 16.5H20.25" />
  </>
);

/** Cierre: logotipo centrado y contacto debajo (recetario p61–65). */
const cierre: DibujoLamina = () => (
  <>
    <Marco />
    <Acento><Bloque x={9} y={8.25} w={6} h={4.5} tono="pleno" /></Acento>
    <Trazo d="M7.5 15.75H16.5" />
  </>
);

const ESTRUCTURA: Readonly<Record<string, DibujoLamina>> = {
  p_slide_portada: portada,
  p_slide_objetivo_icono: objetivo,
  p_slide_tabla_tecnica: fichaTecnica,
  p_slide_indice: indice,
  p_slide_top_two_box: topTwoBox,
  p_slide_redondeo: redondeo,
  p_slide_seccion: seccion,
  p_slide_cierre: cierre,
};

/** Ícono propio (dibujado): 22 del estándar + 8 de estructura. */
export const ICONOS_LAMINA: Readonly<Record<string, DibujoLamina>> = {
  ...Object.fromEntries(
    Object.keys(RANURAS_ESTANDAR).map((id): [string, DibujoLamina] =>
      [id, (o) => laminaEstandar(id, CON_POBLACION.has(id), o)]),
  ),
  ...ESTRUCTURA,
};

export function dibujoLamina(tipo: string): DibujoLamina | null {
  const propio = ICONOS_LAMINA[tipo];
  if (propio) return propio;
  const base = ALIAS_LAMINA[tipo];
  return base ? (o) => laminaEstandar(base, true, o) : null;
}
