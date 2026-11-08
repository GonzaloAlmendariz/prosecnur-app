// Inspector › Lámina del cierre con hallazgos (`p_slide_cierre_hallazgos`, ADR 0135 §6): de tres a cinco hallazgos, cada
// uno con una cifra de una lámina de resumen del informe y la frase del analista (FilaCierre). Arriba, la maqueta con las
// tarjetas en su lugar (MaquetaCierre). Reutiliza las filas de «Hallazgos clave» (hallazgos.css); lo propio es la
// referencia viva a otra lámina (modeloCierre.ts). Las cifras se piden aquí una vez para todas las filas
// (useCifrasDeOrigenes): las de las láminas en uso y, con «Elegir cifra» abierto, las de todas.

import { useEffect, useId, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ListChecks, Plus } from "../../../../vendor/lucide-react";
import type { ArgMetadata, Slide } from "../../../../api/graficos";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { useGraficosReportScope } from "../../reportScope";
import { revelarFilaNueva, revelarYEnfocar, selectorFila } from "../../revelarFila";
import { usePlanStore } from "../../store";
import { AyudaGlobo } from "../AyudaGlobo";
import { SeccionLaminaPlegable } from "../tarjetaLamina/SeccionLaminaPlegable";
import { tituloSeccionLamina } from "../tarjetaLamina/seccionesLamina";
import { useElegirCifraUi } from "./elegirCifraStore";
import { FilaCierre } from "./FilaCierre";
import { MaquetaCierre } from "./MaquetaCierre";
import type { CifrasLeidas } from "./modeloElegirCifra";
import { tarjetasDelCierre } from "./modeloMaquetaCierre";
import { useCifrasDeOrigenes } from "./useCifrasDeOrigen";
import {
  avisoCantidad, completos, escribirHallazgos, filasIniciales, hallazgoNuevo, MAX_HALLAZGOS, mismosHallazgos, mover,
  origenesDelPlan, type HallazgoCierre,
} from "./modeloCierre";
import "../datosGrafico.css";
import "../contenidoEspecial/contenidoEspecial.css";
import "../hallazgos/hallazgos.css";
import "./cierreHallazgos.css";
import { PulsoButton } from "../../../../components/PulsoButton";

const AYUDA = "De tres a cinco. Cada hallazgo toma una cifra de una lámina de resumen del informe y lleva tu frase. La cifra se vuelve a leer de esa lámina al exportar.";

export function CierreHallazgos({ slide, args }: { slide: Slide; args: readonly ArgMetadata[] }) {
  const idTitulo = useId();
  const idAyuda = useId();
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);
  const slides = usePlanStore((s) => s.plan.slides);
  const scope = useGraficosReportScope(useLocation().search);
  const arg = args.find((a) => a.name === "hallazgos");
  const nombreArg = arg?.name ?? "hallazgos";
  const valor = (slide.payload as Record<string, unknown>)[nombreArg];
  const siguiente = useRef(0);
  const raiz = useRef<HTMLElement>(null);
  const clave = () => { siguiente.current += 1; return `cierre-${siguiente.current}`; };
  const [borrador, setBorrador] = useState<HallazgoCierre[]>(() => filasIniciales(valor, () => clave()));
  const [anuncio, setAnuncio] = useState("");
  // Cambió afuera (deshacer, el plan): manda lo guardado.
  const filas = mismosHallazgos(valor, borrador) ? borrador : filasIniciales(valor, () => clave());
  if (filas !== borrador) setBorrador(filas);

  // «Elegir cifra» abierto no sobrevive a otra lámina: las claves de fila se repiten entre cierres.
  useEffect(() => () => useElegirCifraUi.getState().cerrar(), [slide.id]);
  const origenes = origenesDelPlan(slides);
  const eligiendo = useElegirCifraUi((s) => s.abierta !== null && filas.some((h) => h.clave === s.abierta));
  const enUso = eligiendo ? origenes : origenes.filter((o) => filas.some((h) => h.lamina === o.id));
  const vivas = useCifrasDeOrigenes(enUso, scope);
  const cifrasPorOrigen: Record<string, CifrasLeidas> = {};
  for (const [k, v] of Object.entries(vivas)) cifrasPorOrigen[k] = { cifras: v.cifras?.cifras ?? null, cargando: v.cargando, error: v.error };
  const aplicar = (nuevas: HallazgoCierre[]) => {
    setBorrador(nuevas);
    if (!mismosHallazgos(valor, nuevas)) updatePayload(slide.id, { [nombreArg]: escribirHallazgos(nuevas) });
  };
  const listos = completos(filas, origenes);
  const aviso = avisoCantidad(listos);

  return (
    <SeccionLaminaPlegable seccion="ajustes" titulo={tituloSeccionLamina(slide.tipo, "ajustes")}>
      <section ref={raiz} className="pulso-f6-especial pulso-f6-hallazgos pulso-f6-cierre" aria-labelledby={idTitulo} aria-describedby={idAyuda}
        data-campo={nombreArg} data-qa="cierre-hallazgos" data-qa-geometry-group="graficos/f6-cierre" data-qa-geometry-contract="intrinsic">
        <div className="pulso-f6-especial-cabeza" data-qa-geometry-member>
          <span className="pulso-f6-cierre-rotulo">
            <h3 id={idTitulo} className="pulso-f6-subtitulo">Hallazgos</h3>
            <AyudaGlobo rotulo="Hallazgos" detalle={AYUDA} id={idAyuda} />
          </span>
          <span className="pulso-f6-cierre-cuenta">{`${formatoConteo(listos)} de ${formatoConteo(filas.length)} completos`}</span>
        </div>
        {origenes.length === 0 ? (
          <EstadoVacio icono={<ListChecks size={16} aria-hidden="true" />} titulo="El informe todavía no tiene láminas de resumen" />
        ) : (
          <fieldset className="pulso-f6-hallazgos-campo" data-qa-geometry-member>
            <legend className="pulso-sr-only">Hallazgos del cierre</legend>
            <MaquetaCierre tarjetas={tarjetasDelCierre(filas, cifrasPorOrigen)} onIr={(k) => {
              const disparador = raiz.current?.querySelector(`${selectorFila(k)} .pulso-f6-elegir-cifra-disparador`);
              if (disparador) revelarYEnfocar(disparador);
            }} />
            <ol className="pulso-f6-hallazgos-lista" data-qa-geometry-group="graficos/f6-cierre-lista" data-qa-geometry-contract="intrinsic">
              {filas.map((h, i) => (
                <li key={h.clave} data-fila={h.clave}>
                  <FilaCierre hallazgo={h} numero={i + 1} origenes={origenes} cifrasPorOrigen={cifrasPorOrigen} primero={i === 0} ultimo={i === filas.length - 1}
                    onCambio={(n) => aplicar(filas.map((x, k) => (k === i ? n : x)))}
                    onMover={(d) => aplicar(mover(filas, i, d))}
                    onQuitar={() => { aplicar(filas.filter((_, k) => k !== i)); setAnuncio(`Se quitó el hallazgo ${i + 1}. Ctrl+Z lo devuelve.`); }} />
                </li>
              ))}
            </ol>
            <PulsoButton variant="secondary" size="sm" className="pulso-f6-especial-anadir" data-qa-geometry-capacity="owned"
              disabled={filas.length >= MAX_HALLAZGOS}
              onClick={() => {
                const k = clave();
                aplicar([...filas, hallazgoNuevo(k)]);
                revelarFilaNueva(raiz.current, selectorFila(k));
              }}>
              <Plus size={15} aria-hidden="true" /> Agregar hallazgo
            </PulsoButton>
            {aviso && <span className="pulso-f6-dato-ayuda is-aviso" role="note">{aviso}</span>}
          </fieldset>
        )}
        <span className="pulso-sr-only" aria-live="polite">{anuncio}</span>
      </section>
    </SeccionLaminaPlegable>
  );
}
