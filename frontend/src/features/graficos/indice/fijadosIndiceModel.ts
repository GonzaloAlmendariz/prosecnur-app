// Decisión 32 (A10 W-B): los ajustes del dibujo de los focos del índice que el editor anterior exponía y Láminas no
// edita (`redibujar_focos`, `mostrar_iconos_focos`, `iconos_focos_fill`, `iconos_focos_objeto_unico`) se muestran
// fijados por el recetario con candado visible, en vez de desaparecer en silencio. No se escriben: su valor guardado
// viaja intacto en el plan (vuelve a mandar si la lámina sale por la ruta anterior). Espejo de `lamina_indice_focos.R`:
// `mostrar_iconos_focos = FALSE` el motor nativo SÍ lo respeta; los otros tres no tienen equivalente y el motor los avisa.

import type { ArgMetadata, Slide } from "../../../api/graficos";
import { leerSlideMeta } from "../slideMeta";
import { composicionIndiceEfectiva } from "./modeloIndice";

export const ARGS_FIJADOS_INDICE = ["mostrar_iconos_focos", "redibujar_focos", "iconos_focos_fill", "iconos_focos_objeto_unico"] as const;
export type ArgFijadoIndice = (typeof ARGS_FIJADOS_INDICE)[number];

export type LineaFijadaIndice = {
  arg: ArgFijadoIndice;
  rotulo: string;
  /** Lo que sale en el PowerPoint. */
  valor: string;
  /** El ajuste no cambia nada en esta lámina. */
  sinEfecto: boolean;
  motivo: string;
  /** Qué guarda el proyecto y qué pasa con eso; `null` si no guarda nada. */
  nota: string | null;
};

const ROTULOS: Record<ArgFijadoIndice, string> = {
  mostrar_iconos_focos: "Mostrar íconos en focos",
  redibujar_focos: "Redibujar focos desde cero",
  iconos_focos_fill: "Colores de focos",
  iconos_focos_objeto_unico: "Mover círculo e ícono juntos",
};

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Lo que guarda el plan para el arg: al nivel del slide o, como lo copia el motor, en `estilo`. */
export function valorGuardado(payload: Readonly<Record<string, unknown>>, arg: ArgFijadoIndice): unknown {
  if (payload[arg] !== undefined && payload[arg] !== null) return payload[arg];
  const estilo = esObjeto(payload.estilo) ? payload.estilo : {};
  return estilo[arg] ?? undefined;
}

/** Los colores guardados, sin huecos. */
function colores(v: unknown): string[] {
  const lista = Array.isArray(v) ? v.flat(Infinity) : typeof v === "string" ? v.split(/\r?\n/) : [];
  return lista.map((x) => String(x ?? "").trim()).filter((x) => x.length > 0);
}

function textoGuardado(arg: ArgFijadoIndice, v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (arg === "iconos_focos_fill") {
    const n = colores(v).length;
    return n === 0 ? null : `${n} ${n === 1 ? "color" : "colores"}`;
  }
  if (typeof v === "boolean") return v ? "Sí" : "No";
  const s = String(v).trim();
  return s.length ? s : null;
}

/** El valor por defecto del registro, como lo usaría la ruta anterior si el plan no guarda nada. */
function textoDefecto(arg: ArgFijadoIndice, meta: ArgMetadata | undefined): string {
  if (arg === "iconos_focos_fill") return "La paleta del índice";
  const d = meta?.default ?? (arg === "redibujar_focos" ? false : true);
  return d === true ? "Sí" : "No";
}

/** ¿Esta lámina sale por la ruta anterior? (estilo de focos declarado o motor nativo apagado a mano) */
export function indicePorRutaAnterior(slide: Pick<Slide, "payload">): boolean {
  return composicionIndiceEfectiva(slide) === "focos" || leerSlideMeta(slide).motor_nativo === false;
}

export function lineasFijadasIndice(slide: Pick<Slide, "payload">, args: readonly ArgMetadata[] = []): LineaFijadaIndice[] {
  const payload = slide.payload ?? {};
  const ruta = indicePorRutaAnterior(slide);
  return ARGS_FIJADOS_INDICE.map((arg) => {
    const meta = args.find((a) => a.name === arg);
    const rotulo = meta?.label || ROTULOS[arg];
    const guardado = valorGuardado(payload, arg);
    const texto = textoGuardado(arg, guardado);

    if (ruta) {
      return {
        arg, rotulo,
        valor: texto ?? textoDefecto(arg, meta),
        sinEfecto: false,
        motivo: "Esta lámina sale por la ruta anterior: se usa el valor guardado en el plan, sin cambiarlo.",
        nota: null,
      };
    }

    if (arg === "mostrar_iconos_focos") {
      const oculta = guardado === false;
      return {
        arg, rotulo,
        valor: oculta ? "No: la lista sale sin íconos" : "Sí: cada capítulo con el ícono elegido arriba",
        sinEfecto: false,
        motivo: "Fijo por diseño: el ícono de cada capítulo se elige arriba, uno por uno («Sin ícono» quita el de un capítulo).",
        nota: oculta
          ? "El proyecto guarda «no mostrar íconos»: el motor lo respeta y quita todos los íconos de la lista, aunque elijas uno arriba."
          : null,
      };
    }

    const motivo = arg === "redibujar_focos"
      ? "Fijo por diseño: la lista del índice se dibuja entera desde su composición; no hay focos de la plantilla que redibujar."
      : arg === "iconos_focos_fill"
        ? "Fijo por diseño: el color y el tamaño de cada ícono los pone la composición del índice."
        : "Fijo por diseño: cada ícono va junto a su capítulo en la lista; no hay un círculo aparte que mover.";
    return {
      arg, rotulo,
      valor: "No se aplica en esta lámina",
      sinEfecto: true,
      motivo,
      nota: texto
        ? `El proyecto guarda «${texto}»: se conserva tal cual y vuelve a usarse si la lámina sale por la ruta anterior.`
        : null,
    };
  });
}
