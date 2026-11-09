// El inspector de las tarjetas entre públicos (ADR 0138), dentro de «Tarjetas de diferencias» con el modo «Entre
// públicos». Lee GET /api/graficos/diferencias?slide=<id> (modo_letras «entre_publicos») y muestra, por tema, su estado
// y motivo (equivalencia, escala, base mínima, conciliación, familia), sus públicos con p y n, y sus pares con el
// veredicto: ▲ marcada, △ frágil con contorno punteado, y sin marca lo demás. Al final, el pie de la prueba.
//
// C1: la superficie declara su estado (`data-estado`) y su grupo de geometría; mientras calcula, la marca «todavía no»
// la lleva CargaDeBloque. C3: el vacío (sin temas) vive en su propia caja y dice dónde declarar la matriz. C5: «sin_temas» en un
// panorama es una desconexión con la matriz (no un vacío legítimo) y se dice así. Juicio del analista: nada se
// interpreta; el intervalo de Newcombe va como dato secundario, nunca como la marca.

import { useNavigate } from "react-router-dom";
import { AlertTriangle, RotateCcw } from "../../../../vendor/lucide-react";
import type { LaminaDiferencias, ParPublico, TemaEntrePublicos } from "../../../../api/graficosDiferencias";
import { PulsoButton, PulsoButtonEnlace } from "../../../../components/PulsoButton";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { CargaDeBloque } from "../../../../components/CargaDeBloque";
import { serializarDireccion } from "../../../../lib/navegacion/direccion";
import { PANEL_DIFERENCIAS_REGLA } from "../../panelesGraficos";
import { leerSlideMeta } from "../../slideMeta";
import { usePlanStore } from "../../store";
import { CajaDiferencias } from "./CajaDiferencias";
import { Capsula } from "./Capsula";
import { CodigoError } from "./CodigoError";
import {
  conteosPublicos,
  datosPar,
  diferenciaPar,
  dondeDeclarar,
  estadoPublicos,
  faltaEquivalencia,
  marcaDe,
  parEnPalabras,
  publicoEnPalabras,
  rotuloEquivalencia,
  rotuloEstadoTema,
  rotuloVeredicto,
  textoFamilia,
  type DondeDeclarar,
  type EstadoPublicos,
} from "./modeloDiferenciasPublicos";
import { useClaveDiferencias, useDiferenciasLamina } from "./useDiferencias";
import "./diferencias.css";
import "./diferenciasPublicos.css";

/** Carga › Equivalencias, donde se declara la matriz. */
export const DIRECCION_MATRIZ = serializarDireccion({ modulo: "procesamiento", seccion: "carga", pestana: "equivalencias" });

type Props = {
  slideId: string;
  graficador: string;
  onAbrirRegla: () => void;
  onIrAlEmparejado?: () => void;
};

export function DiferenciasPublicos({ slideId, graficador, onAbrirRegla, onIrAlEmparejado }: Props) {
  const claveGraficos = useClaveDiferencias(slideId);
  // La opción de la lámina (temas, tope, cortos) también cambia el resultado.
  const claveOpcion = usePlanStore((s) => {
    const slide = s.plan.slides.find((x) => x.id === slideId);
    return slide ? JSON.stringify(leerSlideMeta(slide).tarjetas_diferencias ?? null) : "";
  });
  const { carga, reintentar } = useDiferenciasLamina(slideId, `${claveGraficos}|${claveOpcion}`, true);
  const estado = estadoPublicos(carga);
  const lamina = carga && carga.estado !== "error" ? carga.datos?.lamina ?? null : null;
  const errorCarga = carga?.estado === "error" ? { code: carga.code, message: carga.message, error_id: carga.error_id } : null;
  return (
    <DiferenciasPublicosVista estado={estado} lamina={lamina} errorCarga={errorCarga} donde={dondeDeclarar(graficador)}
      onReintentar={reintentar} onAbrirRegla={onAbrirRegla} onIrAlEmparejado={onIrAlEmparejado} />
  );
}

type VistaProps = {
  estado: EstadoPublicos;
  lamina: LaminaDiferencias | null;
  errorCarga: { code: string; message: string; error_id: string | null } | null;
  donde: DondeDeclarar;
  onReintentar: () => void;
  onAbrirRegla: () => void;
  onIrAlEmparejado?: () => void;
};

/** La sección por estado, sin red: lo que pintan los tests. */
export function DiferenciasPublicosVista(props: VistaProps) {
  const { estado } = props;
  return (
    <section
      className="pulso-sig-publicos"
      aria-label="Diferencias entre públicos"
      data-estado={estado}
      data-audit-ready="graficos-diferencias-publicos"
      data-qa-surface="graficos/f6-diferencias-publicos"
      data-qa-geometry-group="graficos/f6-diferencias-publicos"
      data-qa-geometry-contract="intrinsic"
      aria-busy={estado === "calculando"}
    >
      <Cuerpo {...props} />
    </section>
  );
}

function Cuerpo({ estado, lamina, errorCarga, donde, onReintentar, onAbrirRegla, onIrAlEmparejado }: VistaProps) {
  switch (estado) {
    case "calculando":
      // La marca «todavía no» la lleva CargaDeBloque; se quita al llegar la lámina o su error.
      return <CargaDeBloque label="Comparando los públicos…" />;
    case "error": {
      const e = lamina?.error ?? errorCarga;
      return (
        <CajaDiferencias tono="peligro" role="alert" data-qa-geometry-member="">
          <strong className="pulso-sig-titulo">La prueba no pudo ejecutarse</strong>
          <p className="pulso-sig-texto">{e?.message || "El cálculo de diferencias entre públicos falló."}</p>
          {(e?.code || e?.error_id) && <p className="pulso-sig-codigo"><CodigoError code={e?.code} errorId={e?.error_id} /></p>}
          <div className="pulso-sig-acciones">
            <PulsoButton variant="secondary" size="sm" onClick={onReintentar}><RotateCcw size={14} aria-hidden="true" /> Reintentar</PulsoButton>
            <PulsoButton variant="ghost" size="sm" data-pulso-abre-panel={PANEL_DIFERENCIAS_REGLA.id} onClick={onAbrirRegla}>Revisar la regla</PulsoButton>
          </div>
        </CajaDiferencias>
      );
    }
    case "sin_temas":
      return (
        <CajaDiferencias tono="aviso" role="note" data-qa-geometry-member="" data-vacio={donde === "matriz" ? "sin-matriz" : "sin-temas"}>
          <strong className="pulso-sig-titulo"><AlertTriangle size={14} aria-hidden="true" /> Sin equivalencia declarada</strong>
          <p className="pulso-sig-texto">
            {donde === "matriz"
              ? "El panorama compara sólo las filas confirmadas de la matriz de equivalencias, y no hay ninguna con este tema en dos públicos. Declara la matriz para comparar."
              : "Ningún tema de este gráfico tiene la misma pregunta declarada en dos públicos."}
          </p>
          <DondeDeclararAcciones donde={donde} onIrAlEmparejado={onIrAlEmparejado} />
        </CajaDiferencias>
      );
    case "abstencion":
    case "ninguna":
    case "con_marcas":
      return lamina ? <Resultado lamina={lamina} estado={estado} donde={donde} onIrAlEmparejado={onIrAlEmparejado} /> : null;
  }
}

function DondeDeclararAcciones({ donde, onIrAlEmparejado }: { donde: DondeDeclarar; onIrAlEmparejado?: () => void }) {
  const navegar = useNavigate();
  return (
    <div className="pulso-sig-acciones">
      {donde === "temas" && onIrAlEmparejado && (
        <PulsoButton variant="secondary" size="sm" onClick={onIrAlEmparejado}>Ir a los temas por público</PulsoButton>
      )}
      <PulsoButtonEnlace variant="link" size="sm" nav href={DIRECCION_MATRIZ}
        onClick={(e) => { e.preventDefault(); navegar(DIRECCION_MATRIZ); }}>
        Matriz de equivalencias
      </PulsoButtonEnlace>
    </div>
  );
}

function Resultado({ lamina, estado, donde, onIrAlEmparejado }: {
  lamina: LaminaDiferencias; estado: "abstencion" | "ninguna" | "con_marcas"; donde: DondeDeclarar; onIrAlEmparejado?: () => void;
}) {
  const ep = lamina.entre_publicos;
  const temas = ep?.temas ?? [];
  const c = conteosPublicos(temas);
  const familia = ep ? textoFamilia(ep.familia) : null;
  return (
    <>
      <ul className="pulso-sig-chips" aria-label="Resumen entre públicos" data-qa-geometry-member="">
        <li className="pulso-sig-chip">{formatoConteo(c.comparados)} de {formatoConteo(c.temas)} {c.temas === 1 ? "tema comparado" : "temas comparados"}</li>
        <li className={`pulso-sig-chip${c.marcadas ? " is-marcada" : ""}`}>
          {c.marcadas > 0 && <Capsula letras="" decorativa />} {c.marcadas === 1 ? "1 par marcado" : `${formatoConteo(c.marcadas)} pares marcados`}
        </li>
        {c.fragiles > 0 && <li className="pulso-sig-chip is-fragil">{c.fragiles === 1 ? "1 frágil" : `${formatoConteo(c.fragiles)} frágiles`}</li>}
        {c.sinEquivalencia > 0 && <li className="pulso-sig-chip is-aviso">{formatoConteo(c.sinEquivalencia)} sin equivalencia declarada</li>}
      </ul>
      {estado === "abstencion" && lamina.motivo && (
        <p className="pulso-sig-texto" data-qa-geometry-member="">No se compara ningún tema: {lamina.motivo}.</p>
      )}
      <ol className="pulso-sig-pub-temas" aria-label="Temas" data-qa-geometry-member="">
        {temas.map((t, i) => <TemaPublicos key={`${t.fila}-${i}`} tema={t} donde={donde} onIrAlEmparejado={onIrAlEmparejado} />)}
      </ol>
      {familia && <p className="pulso-sig-texto is-referencia" data-qa-geometry-member="">{familia}</p>}
      {lamina.nota && <p className="pulso-sig-pub-nota" data-qa-geometry-member="">{lamina.nota}</p>}
    </>
  );
}

function TemaPublicos({ tema, donde, onIrAlEmparejado }: { tema: TemaEntrePublicos; donde: DondeDeclarar; onIrAlEmparejado?: () => void }) {
  const falta = faltaEquivalencia(tema);
  return (
    <li className="pulso-sig-pub-tema" data-estado={tema.estado}>
      <div className="pulso-sig-pub-cabecera">
        <strong className="pulso-sig-pub-fila" title={tema.fila}>{tema.fila || "Tema sin nombre"}</strong>
        <span className={`pulso-sig-chip${tema.estado === "evaluable" ? "" : " is-aviso"}`}>{rotuloEstadoTema(tema)}</span>
      </div>
      <dl className="pulso-sig-pub-datos">
        <dt>Equivalencia</dt>
        <dd>{rotuloEquivalencia(tema.equivalencia)}</dd>
        {tema.indicador && (<><dt>Indicador</dt><dd>{tema.indicador}</dd></>)}
        {tema.motivo && (<><dt>Motivo</dt><dd>{tema.motivo}</dd></>)}
      </dl>
      {tema.grupos.length > 0 && (
        <ul className="pulso-sig-pub-publicos" aria-label={`Públicos de ${tema.fila}`}>
          {tema.grupos.map((g) => <li key={g.base} className={g.comparable ? undefined : "is-no-comparable"}>{publicoEnPalabras(g)}</li>)}
        </ul>
      )}
      {tema.pares.length > 0 && (
        <ul className="pulso-sig-pub-pares" aria-label={`Pares de ${tema.fila}`}>
          {tema.pares.map((p, i) => <ParFila key={`${p.a}-${p.b}-${i}`} par={p} tema={tema} />)}
        </ul>
      )}
      {falta && <DondeDeclararAcciones donde={donde} onIrAlEmparejado={onIrAlEmparejado} />}
    </li>
  );
}

function ParFila({ par, tema }: { par: ParPublico; tema: TemaEntrePublicos }) {
  const marca = marcaDe(par.veredicto);
  return (
    <li className={`pulso-sig-pub-par${marca === "firme" ? " is-marcada" : marca === "fragil" ? " is-fragil" : ""}`} data-veredicto={par.veredicto}>
      <span className="pulso-sig-pub-par-quien">{parEnPalabras(par, tema.grupos)}</span>
      <span className="pulso-sig-pub-par-dif">{diferenciaPar(par)}</span>
      <span className="pulso-sig-pub-par-veredicto">
        {marca && <Capsula letras="" fragil={marca === "fragil"} decorativa />}
        {rotuloVeredicto(par)}
      </span>
      <span className="pulso-sig-pub-par-dato">{datosPar(par)}</span>
    </li>
  );
}
