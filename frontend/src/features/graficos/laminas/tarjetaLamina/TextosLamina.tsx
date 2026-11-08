// Pestaña «Lámina» del inspector, sección Textos (G14): los textos de la lámina en el orden en que salen, el antetítulo
// y el contenido especial que no son ajustes (filas de la ficha técnica, actores, íconos subidos, capítulos del índice).
// Los ajustes de las láminas de resumen van en sus propias secciones (PestanaLamina).

import { useId, useMemo } from "react";
import { History, Lock } from "../../../../vendor/lucide-react";
import type { Slide, SlideType } from "../../../../api/graficos";
import { EditorIndice } from "../../indice/EditorIndice";
import { ARGS_FIJADOS_INDICE } from "../../indice/fijadosIndiceModel";
import { conSlideMeta, leerSlideMeta } from "../../slideMeta";
import { SLIDE_GRAF_SLOTS, usePlanStore } from "../../store";
import { useGraficosRegistry } from "../../useGraficosRegistry";
import { useVariables } from "../../useVariables";
import { antetituloDelTipo, esLaminaFija } from "../antetituloDelTipo";
import { useAntetituloSeccionActivo } from "../antetituloQueSale";
import { ContenidoEspecialLamina } from "../contenidoEspecial/ContenidoEspecialLamina";
import { contenidoEspecialDe, esArgEspecial, tituloPorDefecto, type ContenidoEspecial } from "../contenidoEspecial/modeloContenidoEspecial";
import { contenidoDeLamina, type ContenidoLamina } from "../contenidoLamina";
import type { LaminaEnEstructura } from "../modeloEstructura";

/** Orden de los textos en la lámina: arriba hacia abajo. Los demás campos van después, en el orden del registro. */
const ORDEN_TEXTOS = ["titulo", "subtitulo", "texto", "fecha", "subtexto", "base", "nota", "pie"];
const ordenTexto = (n: string) => { const i = ORDEN_TEXTOS.indexOf(n); return i < 0 ? ORDEN_TEXTOS.length : i; };

/** Rótulos y ayudas de los textos de la lámina, en el idioma del usuario (el registro trae «slide» y «disclaimer»). */
const TEXTOS_CAMPO: Record<string, { label: string; descripcion: string }> = {
  titulo: { label: "Título", descripcion: "Va arriba de la lámina." },
  subtitulo: { label: "Subtítulo", descripcion: "Línea bajo el título." },
  base: { label: "Base", descripcion: "Vacía, sale la base automática." },
  pie: { label: "Nota al pie", descripcion: "Fuente u otra aclaración al pie de la lámina." },
  // H6 (2026-11-05): el registro lo llama «Etiqueta corta», como el nombre corto de una pregunta. Es el texto pequeño
  // sobre el bloque de la lámina (hallazgos, resumen): un antetítulo del bloque, no del título.
  etiqueta: { label: "Antetítulo del bloque", descripcion: "Texto pequeño sobre el bloque de la lámina." },
};

// El objetivo dice su rótulo junto a la diana, no arriba de la lámina (`.lam_laminas_objetivo`, lamina_identidad.R).
const TEXTOS_OBJETIVO: Record<string, { label: string; descripcion: string }> = {
  titulo: { label: "Rótulo", descripcion: "Va junto a la diana." },
};

// Los capítulos e íconos tienen su editor; los ajustes del dibujo de los focos, su candado (decisión 32).
const ARGS_DEL_INDICE = new Set<string>(["secciones", "subtemas", "subindices", "iconos_focos", ...ARGS_FIJADOS_INDICE]);

/** Los campos de texto de la lámina y su contenido especial (filas, íconos, ajustes de las de resumen). */
export function useContenidoLamina(tipo: SlideType): { contenido: ContenidoLamina; especial: ContenidoEspecial } {
  const { slidesById } = useGraficosRegistry();
  const argsDelTipo = slidesById[tipo]?.args;
  const esIndice = tipo === "p_slide_indice";
  // Los capítulos, subcapítulos e íconos del índice tienen su editor (A5 rebanada 2b), y las filas de la ficha técnica y
  // el ícono subido, el suyo (C38): no son campos de texto sueltos.
  return useMemo(() => {
    const args = (argsDelTipo ?? []).filter((a) => !(esIndice && ARGS_DEL_INDICE.has(a.name)));
    return {
      contenido: contenidoDeLamina(args.filter((a) => !esArgEspecial(a, tipo)), SLIDE_GRAF_SLOTS[tipo] ?? [], tipo),
      especial: contenidoEspecialDe(args, tipo),
    };
  }, [argsDelTipo, tipo, esIndice]);
}

type Props = { slide: Slide; lamina: LaminaEnEstructura; contenido: ContenidoLamina; especial: ContenidoEspecial };

/** Los textos de la lámina, en el orden en que salen, y su contenido especial que no son ajustes. */
export function TextosLamina({ slide, lamina, contenido, especial }: Props) {
  const seccionActiva = useAntetituloSeccionActivo();
  // Campos de texto de alto propio (una línea, varias líneas, con o sin ayuda): grupo intrínseco.
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);
  const meta = leerSlideMeta(slide);
  const esIndice = slide.tipo === "p_slide_indice";
  const { variables } = useVariables();
  const payload = slide.payload as Record<string, unknown>;
  // C35: sin título escrito sale el nombre de la pregunta del gráfico, como en el editor anterior y en el motor.
  const titulo = tituloPorDefecto(slide, variables, lamina.tipoLabel);
  const idAnte = useId();
  const ante = antetituloDelTipo(slide.tipo);

  return (
    <div className="pulso-f6-pila" data-qa-geometry-group="graficos/f6-contenido-campos" data-qa-geometry-contract="intrinsic">
      {ante.modo === "editable" ? (
        <div className="pulso-f6-campo">
          <label htmlFor={idAnte}>Antetítulo</label>
          <input
            id={idAnte}
            data-campo="antetitulo"
            className="pulso-f6-input"
            value={meta.antetitulo ?? ""}
            placeholder={(seccionActiva && lamina.antetituloHeredado) || "Sin antetítulo"}
            onChange={(e) => updatePayload(slide.id, { meta: conSlideMeta(slide, { antetitulo: e.target.value }).payload.meta })}
          />
          <span className="pulso-f6-ayuda-texto">
            {lamina.antetituloHeredado && seccionActiva
              ? `Vacío, hereda “${lamina.antetituloHeredado}” del separador.`
              : lamina.antetituloHeredado
                ? "Vacío, la lámina sale sin antetítulo: el nombre de la sección está apagado en Estilo."
                : "Ningún separador lo precede: sin texto, la lámina sale sin antetítulo."}
          </span>
        </div>
      ) : ante.modo === "capitulo" ? (
        <p className="pulso-f6-candado">
          <Lock size={14} aria-hidden="true" />
          Este separador abre un capítulo: su título es el antetítulo de las láminas que le siguen.
        </p>
      ) : ante.modo === "fijo" ? (
        <p className="pulso-f6-candado">
          <Lock size={14} aria-hidden="true" />
          Antetítulo fijo del estándar: “{ante.texto}”.
        </p>
      ) : null}

      {esLaminaFija(slide.tipo) && (
        <p className="pulso-f6-candado">
          <Lock size={14} aria-hidden="true" />
          Lámina estándar: su título, su texto y su ejemplo salen siempre iguales.
        </p>
      )}

      {!esLaminaFija(slide.tipo) && [...contenido.campos].sort((a, b) => ordenTexto(a.name) - ordenTexto(b.name)).map((c) => (
        <CampoTexto
          key={c.name}
          campo={{ ...c, ...((slide.tipo === "p_slide_objetivo_icono" ? TEXTOS_OBJETIVO[c.name] : null) ?? TEXTOS_CAMPO[c.name] ?? {}) }}
          valor={typeof payload[c.name] === "string" ? (payload[c.name] as string) : ""}
          placeholder={c.name === "titulo" ? titulo.placeholder : ""}
          ayuda={c.name === "titulo" ? titulo.ayuda : null}
          onCambio={(v) => updatePayload(slide.id, { [c.name]: v })}
        />
      ))}

      <ContenidoEspecialLamina slide={slide} especial={especial} />

      {esIndice && <EditorIndice slide={slide} />}

      {!esLaminaFija(slide.tipo) && contenido.pendientes.length > 0 && (
        <p className="pulso-f6-pendiente">
          <History size={14} aria-hidden="true" />
          <span>
            {contenido.pendientes.join(", ")}: este ajuste todavía no está en Láminas.
          </span>
        </p>
      )}
    </div>
  );
}

function CampoTexto({ campo, valor, placeholder, ayuda = null, onCambio }: {
  campo: { name: string; label: string; multilinea: boolean; descripcion: string };
  valor: string;
  placeholder: string;
  /** Ayuda que no viene del registro (qué sale si queda vacío). */
  ayuda?: string | null;
  onCambio: (v: string) => void;
}) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const textoAyuda = [campo.descripcion, ayuda].filter((t): t is string => !!t).join(" ");
  return (
    <div className="pulso-f6-campo">
      <label htmlFor={id}>{campo.label}</label>
      {campo.multilinea ? (
        <textarea id={id} data-campo={campo.name} className="pulso-f6-input" rows={3} value={valor} placeholder={placeholder}
          aria-describedby={textoAyuda ? idAyuda : undefined} onChange={(e) => onCambio(e.target.value)} />
      ) : (
        <input id={id} data-campo={campo.name} className="pulso-f6-input" value={valor} placeholder={placeholder}
          aria-describedby={textoAyuda ? idAyuda : undefined} onChange={(e) => onCambio(e.target.value)} />
      )}
      {textoAyuda && <span id={idAyuda} className="pulso-f6-ayuda-texto">{textoAyuda}</span>}
    </div>
  );
}
