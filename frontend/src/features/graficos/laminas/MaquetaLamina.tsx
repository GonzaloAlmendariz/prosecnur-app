// Maqueta de la lámina: lo que el visor muestra sin pedir la vista previa del motor. Cada gráfico ocupa su ranura real
// (la composición del tipo de lámina) con su FICHA VISUAL (contrato docs/qa/contrato-maqueta-lamina-2026-10-13.md): qué
// gráfico es, su dibujo con la configuración, preguntas, públicos, leyenda y ajustes; los textos son los de la lámina. Todo es seleccionable, igual que sobre la imagen: un gráfico abre su tarjeta y un texto, su
// campo. No necesita LibreOffice, así que abrir una lámina nunca obliga a esperar.

import { dependenciaDe, quienesPorDefecto } from "./DependenciaLamina";
import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import type { Slide } from "../../../api/graficos";
import { ComposicionLamina } from "../iconos/ComposicionLamina";
import { composicionDe } from "../iconos/composicion";
import { IconoTipo } from "../iconos/IconoTipo";
import { LAMINA_PULGADAS } from "../iconos/composicion";
import { graficadorDisplayName } from "../graficadorDisplay";
import { fichaRetirado } from "../retirados";
import { SLIDE_GRAF_SLOTS, usePlanStore } from "../store";
import { useGraficosRegistry } from "../useGraficosRegistry";
import { useVariables } from "../useVariables";
import type { LaminaEnEstructura } from "./modeloEstructura";
import { baseAutomatica, ranurasDeMaqueta } from "./modeloMaqueta";
import { fichaDeRanura } from "./maqueta/fichaModelo";
import { nombreGraficoEnFicha, nombreTipoEnFicha } from "./maqueta/nombreEnFicha";
import { FichaRanura } from "./maqueta/FichaRanura";
import { AvisoMaqueta } from "./maqueta/AvisoMaqueta";
import { LlaveDependencia } from "./maqueta/LlaveDependencia";
import { useConteosMaqueta } from "./maqueta/useConteosMaqueta";
import { firmaReglaDeRanura } from "./maqueta/reglaDeRanura";
import { useTotalesRegla } from "./reglaPreguntas/useConteoRegla";
import { useGraficosReportScope } from "../reportScope";
import { datosEstructura } from "./maqueta/datosEstructura";
import { varianteDe } from "./selectores/tiposLamina";
import { camposTextoDe, ZonasTextoLamina, zonasPortada, type CampoTextoLamina } from "./ZonasTextoLamina";
import { tituloDeLamina } from "../rotuloLamina";
import { antetituloQueSale, useAntetituloSeccionActivo } from "./antetituloQueSale";
import { leerSlideMeta } from "../slideMeta";
import { useTituloEnLienzo } from "./modeloTituloLienzo";
import { TituloEnLienzo } from "./TituloEnLienzo";
import { disposicionDe } from "./disposicion/modeloDisposicion";
import "./maquetaLamina.css";

type Props = {
  slide: Slide;
  lamina: LaminaEnEstructura;
  ranuraActiva: number | null;
  onRanura: (k: number) => void;
  onCambiar: (k: number) => void;
  onTexto: (campo: CampoTextoLamina) => void;
  /** Pide la vista real: la maqueta se declara como tal y lleva «Previsualizar» al alcance (AvisoMaqueta). */
  onPrevisualizar?: () => void;
  prepOk?: boolean;
  /** El dato obligatorio que falta (faltaLamina.ts): la maqueta lo dice en vez de ofrecer la vista previa. */
  falta?: string | null;
};

export function MaquetaLamina({ slide, lamina, ranuraActiva, onRanura, onCambiar, onTexto, onPrevisualizar, prepOk, falta = null }: Props) {
  const { variables } = useVariables();
  const { graficadoresById, slidesById, registry } = useGraficosRegistry();
  const slots = SLIDE_GRAF_SLOTS[slide.tipo] ?? [];
  const estructura = composicionDe(slide.tipo, slots, disposicionDe(slide)).fuente === "estructura";
  const presets = usePlanStore((s) => s.presets);
  const informe = usePlanStore((s) => s.plan.slides);
  const paletas = usePlanStore((s) => s.paletas);
  const vinculos = usePlanStore((s) => s.paletasVinculos);
  const ranuras = useMemo(() => ranurasDeMaqueta(slide, variables, presets, { paletas, vinculos }), [slide, variables, presets, paletas, vinculos]);
  const { conteos, listos: conteosListos } = useConteosMaqueta(ranuras);
  // M3: cuántas elige la regla de cada gráfico de resumen, por la misma caché que el inspector (un solo pedido).
  const scope = useGraficosReportScope(useLocation().search);
  const firmasRegla = useMemo(() => ranuras.map((r) => firmaReglaDeRanura(r, scope)), [ranuras, scope]);
  const totalesRegla = useTotalesRegla(firmasRegla);
  const dep = dependenciaDe(slide);
  const rectDe = dep ? ranuras.find((r) => r.slot === dep.de)?.rect : undefined;
  const rectA = dep ? ranuras.find((r) => r.slot === dep.a)?.rect : undefined;
  const quienes = dep ? (dep.frase || quienesPorDefecto(dep.habilita)) : "";
  const seccionActiva = useAntetituloSeccionActivo();
  const antetitulo = antetituloQueSale(leerSlideMeta(slide).antetitulo, lamina.antetituloHeredado, seccionActiva);
  // El pie dice lo que saldrá: la base escrita por el usuario o, si no hay, la que arma el motor.
  const baseEscrita = typeof (slide.payload as Record<string, unknown>).base === "string" ? ((slide.payload as Record<string, unknown>).base as string).trim() : "";
  const formatoBase = typeof (presets.base as Record<string, unknown> | undefined)?.formato === "string" ? ((presets.base as Record<string, unknown>).formato as string) : undefined;
  const baseAuto = useMemo(() => baseAutomatica(slide, variables, formatoBase), [slide, variables, formatoBase]);
  const campos = camposTextoDe(slide.tipo, slidesById[slide.tipo]?.args, !estructura);
  // R9-8 (criterio del analista: ningún título generado se muestra como real): la maqueta sólo pinta el título ESCRITO.
  // Sin él, el marcador «Título», atenuado (hallazgo 12); nunca el enunciado de la pregunta en el color del texto, que
  // se leía como un título ya puesto. El clic lo vuelve un campo vacío, sin título sugerido.
  const tituloVisible = tituloDeLamina(slide.payload) || <span className="is-vacio">Título</span>;
  const titulo = useTituloEnLienzo(slide);
  const conGrafico = ranuras.filter((r) => r.k !== null && r.graficador).length;

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
        <AvisoMaqueta onPrevisualizar={onPrevisualizar} prepOk={prepOk} falta={falta} />
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
          <TituloEnLienzo {...titulo} variante="maqueta" mostrado={tituloVisible} />
        ) : (
          <span className="pulso-f6-maqueta-titulo">{tituloVisible}</span>
        )}
      </div>

      <span className="pulso-f6-maqueta-composicion" title={lamina.tipoLabel}>
        <IconoTipo clase="lamina" tipo={slide.tipo} size={16} />
        <span>{lamina.tipoLabel}</span>
      </span>

      {ranuras.map((r, i) => {
        // F1: con un solo gráfico, el nombre que el mazo le dio a la lámina (`meta.nombre`) manda sobre el de su tipo.
        // Ronda 19: una versión del catálogo se nombra «<tipo>, versión <versión>», como en el inspector y el selector.
        const nombreTipo = nombreTipoEnFicha(slide, r.graficador ? nombreGraficoEnFicha(r.graficador, r.args, graficadorDisplayName(r.graficador, graficadoresById[r.graficador])) : null, conGrafico);
        const activa = r.k !== null && r.k === ranuraActiva;
        const estilo = { left: `${r.rect.x * 100}%`, top: `${r.rect.y * 100}%`, width: `${r.rect.w * 100}%`, height: `${r.rect.h * 100}%` };
        if (r.k === null) {
          return <span key={i} className="pulso-f6-maqueta-ranura is-cifra" style={estilo} aria-hidden="true"><span className="pulso-f6-maqueta-cifras">Cifras</span></span>;
        }
        const base = fichaDeRanura(r, nombreTipo, r.variable ? conteos.get(r.variable) : null, totalesRegla.get(firmasRegla[i]) ?? null);
        // Dependencia entre los dos gráficos: el dependiente dice quiénes lo responden; el independiente, a quién habilita.
        const conDependencia = !dep ? base : r.slot === dep.a
          ? { ...base, ajustes: [`Sólo quienes ${quienes.replace(/^que\s+/, "")}`, ...base.ajustes] }
          : r.slot === dep.de ? { ...base, ajustes: [`Habilita: ${dep.habilita.join(", ") || "…"}`, ...base.ajustes] } : base;
        // R11-3: un tipo retirado (ADR 0137) no se dibuja como uno vigente: su nombre, la ranura punteada y el aviso.
        const retirada = r.graficador ? fichaRetirado(r.graficador, registry) : null;
        const ficha = retirada
          ? { ...conDependencia, tipo: retirada.titulo_humano, preguntas: [], publicos: [], leyendas: [], ajustes: [], faltaPregunta: false, avisos: ["Tipo retirado: sale en blanco"], retirada: true }
          : conDependencia;
        return (
          <button
            key={r.slot ?? i}
            type="button"
            className={`pulso-f6-maqueta-ranura${activa ? " is-activa" : ""}${r.graficador ? "" : " is-vacia"}${retirada ? " is-retirada" : ""}`}
            style={estilo}
            aria-pressed={activa}
            data-retirada={retirada ? "" : undefined}
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
        <button type="button" className="pulso-f6-maqueta-zona pulso-f6-maqueta-pie" onClick={() => onTexto("base")} aria-label="Editar base"
          title={baseEscrita || baseAuto || undefined}>
          {baseEscrita || baseAuto || (slots.length > 1 ? "Cada gráfico lleva su base debajo" : "Base del gráfico")}
        </button>
      )}
      <AvisoMaqueta onPrevisualizar={onPrevisualizar} prepOk={prepOk} falta={falta} />
    </div>
  );
}
