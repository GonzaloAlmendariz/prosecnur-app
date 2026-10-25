// Panel «Palabras» de una pregunta abierta (TXT-6/7). Direccionable: `?panel=palabras` sobre la pregunta que se está
// codificando. Lista las palabras que se reconocen en los comentarios con cuántas personas las usan; el usuario marca
// dos o más y las une eligiendo cuál se muestra, excluye las que no informan y fija las frases que se repiten. Lo que
// se guarda es del proyecto y lo aplican la nube, las citas y el módulo sugerido.
//
// Cáscara: `PanelLateralFuentes` (Radix Dialog, un único dueño de scroll `.pulso-plf-cuerpo`). La búsqueda, «Unir» y
// «Guardar» van en la barra, fuera del scroll, para que sigan a mano en una lista larga.

import { useId } from "react";
import { useInRouterContext } from "react-router-dom";
import type { FraseDetectada, PalabraReconocida } from "../../api/textoAbierto";
import { PulsoButton } from "../../components/PulsoButton";
import { formatoConteo } from "../../lib/formatoNumero";
import { usePanelDireccionable } from "../../lib/navegacion/paneles";
import { Check, Eye, EyeOff, Link2, Pin, Save, Search, Tags, Undo2, X } from "../../vendor/lucide-react";
import { PanelLateralFuentes } from "../carga/fuentes/PanelLateralFuentes";
import {
  claveTermino,
  fraseExcluida,
  fraseFijada,
  grupoDePalabra,
  hayCambios,
  palabrasFrecuentes,
  type AccionPalabras,
  type EstadoPalabras,
} from "./diccionarioPalabras";
import { PANEL_PALABRAS } from "./panelesCodificacion";
import { useDiccionarioPalabras } from "./useDiccionarioPalabras";
import "./palabrasPanel.css";

type Despachar = (a: AccionPalabras) => void;

function personas(n: number): string {
  return `${formatoConteo(n)} ${n === 1 ? "persona" : "personas"}`;
}

export function readinessPalabras(estado: EstadoPalabras): string {
  const l = estado.lectura;
  if (l.fase === "cargando") return "false";
  if (l.fase === "error") return "vacio:error";
  return l.datos.palabras.length || l.datos.frasesDetectadas.length ? "true" : "vacio:sin-palabras";
}

// ---- Abrir --------------------------------------------------------------------

export function PalabrasBoton() {
  const panel = usePanelDireccionable(PANEL_PALABRAS);
  return (
    <PulsoButton variant="secondary" size="sm" onClick={panel.abrir} aria-haspopup="dialog" data-plf-abrir="palabras">
      <Tags size={14} aria-hidden="true" />
      Palabras
    </PulsoButton>
  );
}

// ---- Panel --------------------------------------------------------------------

type PalabrasPanelProps = {
  /** Columna de texto de la pregunta (la que se codifica). */
  variable: string;
  /** Tras guardar: la sugerencia de módulo no se recalcula sola. */
  onGuardado: () => void;
};

export function PalabrasPanel(props: PalabrasPanelProps) {
  return useInRouterContext() ? <PanelConDireccion {...props} /> : null;
}

function PanelConDireccion({ variable, onGuardado }: PalabrasPanelProps) {
  const panel = usePanelDireccionable(PANEL_PALABRAS);
  const { estado, despachar, guardar } = useDiccionarioPalabras(variable, panel.abierto, onGuardado);
  return (
    <PanelLateralFuentes
      panel={panel}
      antetitulo={`Codificación › ${variable}`}
      titulo="Palabras"
      descripcion="Une las palabras que dicen lo mismo, excluye las que no aportan y fija las frases que se repiten. Se aplica a la nube, a las citas y al módulo sugerido de esta pregunta."
      barra={<PalabrasBarra estado={estado} despachar={despachar} onGuardar={() => { void guardar(); }} />}
      auditReady={readinessPalabras(estado)}
      claveDisparador="palabras"
      onCerrar={panel.cerrar}
    >
      <PalabrasCuerpo estado={estado} despachar={despachar} />
    </PanelLateralFuentes>
  );
}

// ---- Barra (fuera del scroll) -------------------------------------------------

type BarraProps = { estado: EstadoPalabras; despachar: Despachar; onGuardar: () => void };

export function PalabrasBarra({ estado, despachar, onGuardar }: BarraProps) {
  const idRadios = useId();
  const lista = estado.lectura.fase === "lista";
  const marcadas = estado.seleccion.length;
  const cambios = hayCambios(estado);
  const guardando = estado.guardado.fase === "guardando";
  return (
    <div className="pulso-cv2-pal-barra" data-qa-geometry-group="codificacion/palabras-barra" data-qa-geometry-contract="intrinsic">
      {/* El mismo buscador del estandarizador de respuestas («Respuestas únicas»). */}
      <div className="pulso-cv2-search pulso-cv2-pal-buscar" data-qa-geometry-member="buscar">
        <Search size={14} className="pulso-cv2-search-icon" aria-hidden="true" />
        <input
          type="search"
          className="pulso-cv2-search-input"
          value={estado.consulta}
          placeholder="Buscar una palabra…"
          aria-label="Buscar una palabra"
          disabled={!lista}
          onChange={(e) => despachar({ tipo: "buscar", consulta: e.target.value })}
        />
        {estado.consulta && (
          <button type="button" className="pulso-icon" aria-label="Limpiar búsqueda" title="Limpiar" onClick={() => despachar({ tipo: "buscar", consulta: "" })}>
            <X size={12} aria-hidden="true" />
          </button>
        )}
      </div>
      {estado.union ? (
        <fieldset className="pulso-cv2-pal-union" data-qa-geometry-member="union">
          <legend>¿Cuál se muestra?</legend>
          <div className="pulso-cv2-pal-union-opciones">
            {estado.union.opciones.map((o) => (
              <label key={o} className="pulso-cv2-pal-union-opcion">
                <input
                  type="radio"
                  name={idRadios}
                  value={o}
                  checked={estado.union?.mostrar === o}
                  onChange={() => despachar({ tipo: "elegir-mostrar", mostrar: o })}
                />
                {o}
              </label>
            ))}
          </div>
          <div className="pulso-cv2-pal-acciones">
            <PulsoButton variant="primary" size="sm" onClick={() => despachar({ tipo: "confirmar-union" })}>
              <Check size={14} aria-hidden="true" />
              Confirmar unión
            </PulsoButton>
            <PulsoButton variant="ghost" size="sm" onClick={() => despachar({ tipo: "cancelar-union" })}>
              Cancelar
            </PulsoButton>
          </div>
        </fieldset>
      ) : (
        <div className="pulso-cv2-pal-acciones" data-qa-geometry-member="acciones">
          <span className="pulso-cv2-pal-marcadas" aria-live="polite">
            {marcadas === 0 ? "Marca palabras para unirlas o excluirlas." : marcadas === 1 ? "1 palabra marcada" : `${marcadas} palabras marcadas`}
          </span>
          <PulsoButton variant="secondary" size="sm" disabled={marcadas < 2} onClick={() => despachar({ tipo: "empezar-union" })}>
            <Link2 size={14} aria-hidden="true" />
            Unir
          </PulsoButton>
          <PulsoButton variant="secondary" size="sm" disabled={marcadas === 0} onClick={() => despachar({ tipo: "excluir-marcadas" })}>
            <EyeOff size={14} aria-hidden="true" />
            Excluir
          </PulsoButton>
          <span className="pulso-cv2-pal-espacio" />
          {cambios && !guardando && <span className="pulso-cv2-pal-pendiente">Cambios sin guardar</span>}
          <PulsoButton variant="primary" size="sm" disabled={!cambios || guardando} onClick={onGuardar}>
            <Save size={14} aria-hidden="true" />
            {guardando ? "Guardando…" : "Guardar"}
          </PulsoButton>
        </div>
      )}
      {estado.guardado.fase === "error" && (
        <p className="pulso-cv2-pal-aviso is-error" role="alert">{estado.guardado.mensaje}</p>
      )}
      {estado.guardado.fase === "ok" && (
        <p className="pulso-cv2-pal-aviso is-ok" role="status">Guardado. El módulo sugerido se recalcula con estas palabras.</p>
      )}
    </div>
  );
}

// ---- Cuerpo (dueño de scroll: .pulso-plf-cuerpo) ------------------------------

type CuerpoProps = { estado: EstadoPalabras; despachar: Despachar };

export function PalabrasCuerpo({ estado, despachar }: CuerpoProps) {
  const l = estado.lectura;
  if (l.fase === "cargando") {
    return (
      <div className="pulso-plf-estado" role="status" data-qa-geometry-capacity="owned">
        <strong>Leyendo las palabras de esta pregunta…</strong>
      </div>
    );
  }
  if (l.fase === "error") {
    return (
      <div className="pulso-plf-estado is-error" role="alert" data-qa-geometry-capacity="owned">
        <strong>No se pudieron leer las palabras</strong>
        <p>{l.mensaje}</p>
      </div>
    );
  }
  const { datos } = l;
  if (!datos.palabras.length && !datos.frasesDetectadas.length && !estado.borrador.frases.length) {
    return (
      <div className="pulso-plf-estado" role="status" data-qa-geometry-capacity="owned">
        <strong>Todavía no hay palabras para revisar</strong>
        <p>Ningún comentario de esta pregunta tiene palabras con contenido.</p>
      </div>
    );
  }
  return (
    <div className="pulso-cv2-pal" data-qa-geometry-group="codificacion/palabras" data-qa-geometry-contract="intrinsic">
      <p className="pulso-cv2-pal-resumen">
        {formatoConteo(datos.resumen.nPalabras)} {datos.resumen.nPalabras === 1 ? "palabra" : "palabras"} en{" "}
        {formatoConteo(datos.resumen.conContenido)} {datos.resumen.conContenido === 1 ? "comentario" : "comentarios"} con contenido.
      </p>
      <GruposSeccion estado={estado} despachar={despachar} />
      {/* Lo corto arriba (unidas, excluidas, frases) y la lista larga al final: las excluidas se ven aparte sin
          recorrer cientos de palabras. */}
      <ExcluidasSeccion estado={estado} despachar={despachar} />
      <FrasesSeccion estado={estado} despachar={despachar} />
      <PalabrasSeccion estado={estado} despachar={despachar} />
    </div>
  );
}

function GruposSeccion({ estado, despachar }: CuerpoProps) {
  const grupos = estado.borrador.equivalencias;
  if (!grupos.length) return null;
  const delServidor = estado.lectura.fase === "lista" ? estado.lectura.datos.grupos : [];
  return (
    <section className="pulso-cv2-pal-seccion" aria-labelledby="pulso-cv2-pal-grupos" data-qa-geometry-member="grupos">
      <div className="pulso-cv2-col-head">
        <h3 id="pulso-cv2-pal-grupos" className="pulso-cv2-col-title">Palabras unidas</h3>
        <span className="pulso-cv2-col-count">{formatoConteo(grupos.length)} {grupos.length === 1 ? "grupo" : "grupos"}</span>
      </div>
      <ul className="pulso-cv2-pal-lista" data-qa-geometry-group="codificacion/palabras-unidas" data-qa-geometry-contract="intrinsic">
        {grupos.map((g) => {
          const guardado = delServidor.find((s) =>
            claveTermino(s.mostrar) === claveTermino(g.mostrar) &&
            s.formas.length === g.formas.length &&
            s.formas.every((f) => g.formas.some((x) => claveTermino(x) === claveTermino(f))));
          return (
            <li key={g.mostrar} className="pulso-cv2-pal-fila is-grupo" data-qa-geometry-member="grupo">
              <span className="pulso-cv2-pal-texto">
                <strong>{g.mostrar}</strong>
                <span className="pulso-cv2-pal-formas">junta {g.formas.join(", ")}</span>
              </span>
              <span className="pulso-cv2-pal-n">{guardado ? personas(guardado.personas) : "Se cuenta al guardar"}</span>
              <button
                type="button"
                className="pulso-cv2-pal-accion"
                aria-label={`Deshacer el grupo «${g.mostrar}»`}
                onClick={() => despachar({ tipo: "deshacer-grupo", mostrar: g.mostrar })}
              >
                <Undo2 size={12} aria-hidden="true" /> Deshacer
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Misma fila que «Respuestas únicas» del estandarizador: check, texto, conteo debajo. El check alimenta «Unir» y
// «Excluir» de la barra.
function PalabraFila({ p, estado, despachar }: { p: PalabraReconocida } & CuerpoProps) {
  const grupo = grupoDePalabra(p, estado.borrador);
  const otras = p.formas.filter((f) => f !== p.forma);
  const marcada = estado.seleccion.includes(p.clave);
  return (
    <div className={`pulso-cv2-resp-row${grupo ? " is-assigned" : ""}${marcada ? " is-marcada" : ""}`} data-qa-geometry-member="palabra">
      <input
        type="checkbox"
        checked={marcada}
        onChange={() => despachar({ tipo: "marcar", clave: p.clave })}
        aria-label={`Marcar «${p.forma}»`}
      />
      <div className="pulso-cv2-resp-main">
        <div className="pulso-cv2-resp-text">{p.forma}</div>
        <div className="pulso-cv2-resp-meta">
          <span><strong>{formatoConteo(p.personas)}</strong> {p.personas === 1 ? "persona" : "personas"}</span>
          {otras.length > 0 && <span>también {otras.join(", ")}</span>}
          {grupo && claveTermino(grupo.mostrar) !== claveTermino(p.forma) && (
            <span className="pulso-cv2-pal-chip">Se muestra como «{grupo.mostrar}»</span>
          )}
          {grupo && claveTermino(grupo.mostrar) === claveTermino(p.forma) && (
            <span className="pulso-cv2-pal-chip">Junta {grupo.formas.length} palabras</span>
          )}
          {p.excluidaEn.map((t) => (
            <span key={t} className="pulso-cv2-pal-chip is-excluida">No se cuenta dentro de «{t}»</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PalabrasSeccion({ estado, despachar }: CuerpoProps) {
  if (estado.lectura.fase !== "lista" || !estado.lectura.datos.palabras.length) return null;
  const frecuentes = palabrasFrecuentes(estado);
  return (
    <section className="pulso-cv2-pal-seccion" aria-labelledby="pulso-cv2-pal-palabras" data-qa-geometry-member="palabras">
      <div className="pulso-cv2-col-head">
        <h3 id="pulso-cv2-pal-palabras" className="pulso-cv2-col-title">Palabras más frecuentes</h3>
        <span className="pulso-cv2-col-count">de más a menos personas</span>
      </div>
      <div className="pulso-cv2-resp-list" data-qa-geometry-group="codificacion/palabras-frecuentes" data-qa-geometry-contract="intrinsic">
        {frecuentes.length === 0 ? (
          <div className="pulso-cv2-resp-empty">
            {estado.consulta.trim() ? `Ninguna palabra coincide con «${estado.consulta.trim()}».` : "Todas las palabras están excluidas."}
          </div>
        ) : (
          frecuentes.map((p) => <PalabraFila key={p.clave} p={p} estado={estado} despachar={despachar} />)
        )}
      </div>
    </section>
  );
}

// Las excluidas, aparte: cada una vuelve a la cuenta con un clic.
function ExcluidasSeccion({ estado, despachar }: CuerpoProps) {
  if (estado.lectura.fase !== "lista") return null;
  const terminos = estado.borrador.excluir;
  if (!terminos.length) return null;
  const palabras = estado.lectura.datos.palabras;
  const frases = estado.lectura.datos.frasesDetectadas;
  return (
    <section className="pulso-cv2-pal-seccion" aria-labelledby="pulso-cv2-pal-excluidas" data-qa-geometry-member="excluidas">
      <div className="pulso-cv2-col-head">
        <h3 id="pulso-cv2-pal-excluidas" className="pulso-cv2-col-title">Palabras excluidas</h3>
        <span className="pulso-cv2-col-count">{formatoConteo(terminos.length)} {terminos.length === 1 ? "término" : "términos"}</span>
      </div>
      <ul className="pulso-cv2-pal-lista" data-qa-geometry-group="codificacion/palabras-excluidas" data-qa-geometry-contract="intrinsic">
        {terminos.map((t) => {
          const k = claveTermino(t);
          const n = palabras.find((p) => p.formas.some((f) => claveTermino(f) === k))?.personas
            ?? frases.find((f) => claveTermino(f.forma) === k)?.personas;
          return (
            <li key={k} className="pulso-cv2-pal-fila is-excluida" data-qa-geometry-member="excluida">
              <span className="pulso-cv2-pal-texto"><strong>{t}</strong></span>
              <span className="pulso-cv2-pal-n">{n != null ? personas(n) : ""}</span>
              <button
                type="button"
                className="pulso-cv2-pal-accion"
                aria-label={`Volver a contar «${t}»`}
                onClick={() => despachar({ tipo: "reincorporar", termino: t })}
              >
                <Eye size={12} aria-hidden="true" /> Volver a contar
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function FraseFila({ f, estado, despachar }: { f: FraseDetectada } & CuerpoProps) {
  const fija = fraseFijada(f, estado.borrador);
  const excluida = fraseExcluida(f, estado.borrador);
  return (
    <li className={`pulso-cv2-pal-fila${excluida ? " is-excluida" : ""}`} data-qa-geometry-member="frase">
      <span className="pulso-cv2-pal-texto">
        <strong>{f.forma}</strong>
        {fija && <span className="pulso-cv2-pal-chip">Se cuenta como una sola</span>}
        {excluida && <span className="pulso-cv2-pal-chip is-excluida">No se cuenta</span>}
      </span>
      <span className="pulso-cv2-pal-n">{f.personas > 0 ? personas(f.personas) : "—"}</span>
      <span className="pulso-cv2-pal-botones">
        <button
          type="button"
          className="pulso-cv2-pal-accion"
          aria-pressed={fija}
          aria-label={fija ? `Soltar la frase «${f.forma}»` : `Fijar la frase «${f.forma}»`}
          onClick={() => despachar({ tipo: "alternar-frase", frase: f.forma })}
        >
          <Pin size={12} aria-hidden="true" /> {fija ? "Soltar" : "Fijar"}
        </button>
        <button
          type="button"
          className="pulso-cv2-pal-accion"
          aria-label={excluida ? `Volver a contar «${f.forma}»` : `Excluir «${f.forma}»`}
          onClick={() => despachar({ tipo: "alternar-excluir", termino: f.forma, formas: [f.forma] })}
        >
          {excluida ? <Eye size={12} aria-hidden="true" /> : <EyeOff size={12} aria-hidden="true" />}
          {excluida ? "Contar" : "Excluir"}
        </button>
      </span>
    </li>
  );
}

function FrasesSeccion({ estado, despachar }: CuerpoProps) {
  if (estado.lectura.fase !== "lista") return null;
  const detectadas = estado.lectura.datos.frasesDetectadas;
  // Las fijadas o excluidas a mano que el servidor no detectó también se ven, para poder soltarlas.
  const propias = [...estado.borrador.frases, ...estado.borrador.excluir.filter((t) => t.includes(" "))]
    .filter((t, i, arr) => arr.findIndex((x) => claveTermino(x) === claveTermino(t)) === i)
    .filter((t) => !detectadas.some((d) => claveTermino(d.forma) === claveTermino(t)))
    .map((t): FraseDetectada => ({ clave: claveTermino(t), forma: t, personas: 0, fija: false, excluida: false }));
  const frases = [...detectadas, ...propias];
  if (!frases.length) return null;
  return (
    <section className="pulso-cv2-pal-seccion" aria-labelledby="pulso-cv2-pal-frases" data-qa-geometry-member="frases">
      <div className="pulso-cv2-col-head">
        <h3 id="pulso-cv2-pal-frases" className="pulso-cv2-col-title">Frases que se repiten</h3>
        <span className="pulso-cv2-col-count">Fijar una frase la cuenta como una sola</span>
      </div>
      <ul className="pulso-cv2-pal-lista" data-qa-geometry-group="codificacion/frases" data-qa-geometry-contract="intrinsic">
        {frases.map((f) => <FraseFila key={f.clave} f={f} estado={estado} despachar={despachar} />)}
      </ul>
    </section>
  );
}
