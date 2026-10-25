// Maqueta de la lámina: lo que el visor muestra sin pedir la vista previa del motor. Cada gráfico ocupa su ranura real
// (la composición del tipo de lámina) con su FICHA VISUAL (contrato docs/qa/contrato-maqueta-lamina-2026-10-13.md): qué
// gráfico es, su dibujo con la configuración, preguntas, públicos, leyenda y ajustes; los textos son los de la lámina. Todo es seleccionable, igual que sobre la imagen: un gráfico abre su tarjeta y un texto, su
// campo. No necesita LibreOffice, así que abrir una lámina nunca obliga a esperar.

import { dependenciaDe, quienesPorDefecto } from "./DependenciaLamina";
import { useMemo } from "react";
import type { Slide } from "../../../api/graficos";
import { ComposicionLamina } from "../iconos/ComposicionLamina";
import { composicionDe } from "../iconos/composicion";
import { IconoTipo } from "../iconos/IconoTipo";
import { LAMINA_PULGADAS } from "../iconos/composicion";
import { graficadorDisplayName } from "../graficadorDisplay";
import { SLIDE_GRAF_SLOTS, usePlanStore } from "../store";
import { useGraficosRegistry } from "../useGraficosRegistry";
import { useVariables } from "../useVariables";
import type { LaminaEnEstructura } from "./modeloEstructura";
import { baseAutomatica, ranurasDeMaqueta } from "./modeloMaqueta";
import { fichaDeRanura } from "./maqueta/fichaModelo";
import { FichaRanura } from "./maqueta/FichaRanura";
import { LlaveDependencia } from "./maqueta/LlaveDependencia";
import { useConteosMaqueta } from "./maqueta/useConteosMaqueta";
import { datosEstructura } from "./maqueta/datosEstructura";
import { varianteDe } from "./selectores/tiposLamina";
import { camposTextoDe, ZonasTextoLamina, zonasPortada, type CampoTextoLamina } from "./ZonasTextoLamina";
import { tituloQueSale } from "./tituloQueSale";
import "./maquetaLamina.css";

type Props = {
  slide: Slide;
  lamina: LaminaEnEstructura;
  ranuraActiva: number | null;
  onRanura: (k: number) => void;
  onCambiar: (k: number) => void;
  onTexto: (campo: CampoTextoLamina) => void;
};

export function MaquetaLamina({ slide, lamina, ranuraActiva, onRanura, onCambiar, onTexto }: Props) {
  const { variables } = useVariables();
  const { graficadoresById, slidesById } = useGraficosRegistry();
  const slots = SLIDE_GRAF_SLOTS[slide.tipo] ?? [];
  const estructura = composicionDe(slide.tipo, slots).fuente === "estructura";
  const presets = usePlanStore((s) => s.presets);
  const informe = usePlanStore((s) => s.plan.slides);
  const paletas = usePlanStore((s) => s.paletas);
  const vinculos = usePlanStore((s) => s.paletasVinculos);
  const ranuras = useMemo(() => ranurasDeMaqueta(slide, variables, presets, { paletas, vinculos }), [slide, variables, presets, paletas, vinculos]);
  const { conteos, listos: conteosListos } = useConteosMaqueta(ranuras);
  const dep = dependenciaDe(slide);
  const rectDe = dep ? ranuras.find((r) => r.slot === dep.de)?.rect : undefined;
  const rectA = dep ? ranuras.find((r) => r.slot === dep.a)?.rect : undefined;
  const quienes = dep ? (dep.frase || quienesPorDefecto(dep.habilita)) : "";
  const antetitulo = lamina.antetituloHeredado;
  // El pie dice lo que saldrá: la base escrita por el usuario o, si no hay, la que arma el motor.
  const baseEscrita = typeof (slide.payload as Record<string, unknown>).base === "string" ? ((slide.payload as Record<string, unknown>).base as string).trim() : "";
  const formatoBase = typeof (presets.base as Record<string, unknown> | undefined)?.formato === "string" ? ((presets.base as Record<string, unknown>).formato as string) : undefined;
  const baseAuto = useMemo(() => baseAutomatica(slide, variables, formatoBase), [slide, variables, formatoBase]);
  const campos = camposTextoDe(slide.tipo, slidesById[slide.tipo]?.args, !estructura);
  // El título que va a salir: el escrito o el de la pregunta del gráfico. Una lámina sin ninguno (varios temas sin
  // enunciado) mostraba el nombre de su tipo, «Un gráfico», como si fuera su título; ahora se ve vacía, como el aviso pide.
  const tituloVisible = tituloQueSale(slide, variables, lamina.tipoLabel) || <span className="is-vacio">Sin título</span>;

  if (estructura) {
    // Portada, índice, separadores: su dibujo de estructura; el título sigue siendo editable con un clic.
    return (
      <div className="pulso-f6-maqueta is-estructura" data-maqueta-tipo={slide.tipo}>
        <ComposicionLamina tipo={slide.tipo} slots={slots} variante={varianteDe(slide)} datos={datosEstructura(slide, informe)} />
        {zonasPortada(slide.tipo, varianteDe(slide)) ? (
          <ZonasTextoLamina onTexto={onTexto} campos={campos} zonas={zonasPortada(slide.tipo, varianteDe(slide)) ?? undefined} />
        ) : campos.has("titulo") && (
          <button type="button" className="pulso-f6-maqueta-zona pulso-f6-maqueta-titulo-estructura" onClick={() => onTexto("titulo")} aria-label="Editar título">
            <span className="pulso-f6-maqueta-titulo">{lamina.titulo}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    // `data-maqueta-conteos`: la leyenda ya lista lo que el motor dibuja (CCSS-UI-3); el QA puede esperarlo.
    <div className="pulso-f6-maqueta" data-maqueta-tipo={slide.tipo} data-maqueta-conteos={conteosListos ? "listos" : "pendientes"}>
      <div className="pulso-f6-maqueta-cabecera">
        {campos.has("antetitulo") && (
          <button type="button" className="pulso-f6-maqueta-zona pulso-f6-maqueta-ante" onClick={() => onTexto("antetitulo")} aria-label="Editar antetítulo">
            {antetitulo || <span className="is-vacio">Antetítulo</span>}
          </button>
        )}
        {campos.has("titulo") ? (
          <button type="button" className="pulso-f6-maqueta-zona pulso-f6-maqueta-titulo" onClick={() => onTexto("titulo")} aria-label="Editar título">
            {tituloVisible}
          </button>
        ) : (
          <span className="pulso-f6-maqueta-titulo">{tituloVisible}</span>
        )}
      </div>

      <span className="pulso-f6-maqueta-composicion" title={lamina.tipoLabel}>
        <IconoTipo clase="lamina" tipo={slide.tipo} size={16} />
        <span>{lamina.tipoLabel}</span>
      </span>

      {ranuras.map((r, i) => {
        const nombreTipo = r.graficador ? graficadorDisplayName(r.graficador, graficadoresById[r.graficador]) : null;
        const activa = r.k !== null && r.k === ranuraActiva;
        const estilo = { left: `${r.rect.x * 100}%`, top: `${r.rect.y * 100}%`, width: `${r.rect.w * 100}%`, height: `${r.rect.h * 100}%` };
        if (r.k === null) {
          return <span key={i} className="pulso-f6-maqueta-ranura is-cifra" style={estilo} aria-hidden="true"><span className="pulso-f6-maqueta-cifras">Cifras</span></span>;
        }
        const base = fichaDeRanura(r, nombreTipo, r.variable ? conteos.get(r.variable) : null);
        // Dependencia entre los dos gráficos: el dependiente dice quiénes lo responden; el independiente, a quién habilita.
        const ficha = !dep ? base : r.slot === dep.a
          ? { ...base, ajustes: [`Sólo quienes ${quienes.replace(/^que\s+/, "")}`, ...base.ajustes] }
          : r.slot === dep.de ? { ...base, ajustes: [`Habilita: ${dep.habilita.join(", ") || "…"}`, ...base.ajustes] } : base;
        return (
          <button
            key={r.slot ?? i}
            type="button"
            className={`pulso-f6-maqueta-ranura${activa ? " is-activa" : ""}${r.graficador ? "" : " is-vacia"}`}
            style={estilo}
            aria-pressed={activa}
            aria-label={`Gráfico ${r.k}: ${ficha.vacia ? "sin gráfico" : ficha.tipo}${ficha.preguntas[0] ? `, ${ficha.preguntas[0]}` : ""}${ficha.publicos.length ? `, ${ficha.publicos.join(", ")}` : ""}${ficha.avisos.length ? `. ${ficha.avisos.join(". ")}` : ""}`}
            // Una ranura vacía va directo a «¿Qué gráfico?»; una con gráfico abre su tarjeta.
            onClick={() => (r.graficador ? onRanura(r.k as number) : onCambiar(r.k as number))}
            onDoubleClick={() => onCambiar(r.k as number)}
          >
            <FichaRanura info={ficha} w={r.rect.w * LAMINA_PULGADAS.w} h={r.rect.h * LAMINA_PULGADAS.h} clave={`${slide.id}-${r.slot ?? i}-`} />
          </button>
        );
      })}

      {rectDe && rectA && <LlaveDependencia de={rectDe} a={rectA} />}

      {campos.has("base") && (
        <button type="button" className="pulso-f6-maqueta-zona pulso-f6-maqueta-pie" onClick={() => onTexto("base")} aria-label="Editar base">
          {baseEscrita || baseAuto || (slots.length > 1 ? "Cada gráfico lleva su base debajo" : "Base del gráfico")}
        </button>
      )}
    </div>
  );
}
