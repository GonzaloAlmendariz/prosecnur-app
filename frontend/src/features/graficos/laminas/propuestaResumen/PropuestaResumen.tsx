// La propuesta del motor como lista para elegir (H13 del checklist de usabilidad del editor, 2026-11-05). Con «Los
// propone el motor» reemplaza al editor atenuado y vacío: muestra por capítulo qué saldría (pregunta, cifra, frase o
// rótulo y la diferencia principal), deja marcar qué queda y «Editar a partir de esta propuesta» pasa a «Los escribo yo»
// con lo marcado en un solo paso deshacible. Con «Los escribo yo», «Traer la propuesta del motor» hace lo mismo y, si ya
// hay capítulos escritos, pregunta si los reemplaza o agrega. Sirve igual a «Hallazgos clave» y al resumen de
// diferencias; la lógica vive en modeloPropuesta.ts y la carga en usePropuestaResumen.ts.

import { useEffect, useId, useRef, useState } from "react";
import type { Slide } from "../../../../api/graficos";
import type { PropuestaResumen as Propuesta } from "../../../../api/graficosPropuesta";
import { CargaDeBloque } from "../../../../components/CargaDeBloque";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { useVariables } from "../../useVariables";
import { ListChecks, PencilLine, RefreshCw, X } from "../../../../vendor/lucide-react";
import {
  alternar,
  avisoNadaMarcado,
  avisosPropuesta,
  capitulosDesdePropuesta,
  combinarCapitulos,
  conteoQuedan,
  cuantosQuedan,
  escritosQueSalen,
  losElementos,
  nombreElemento,
  todosMarcados,
  totalElementos,
  vistaPropuesta,
  type ComoCombinar,
  type ElementoVista,
} from "./modeloPropuesta";
import { usePropuestaResumen } from "./usePropuestaResumen";
import "../datosGrafico.css";
import "./propuestaResumen.css";

type Props = {
  slide: Slide;
  scope: "active" | "consolidated";
  /** `seleccion = "auto"`: la propuesta se muestra sola, en lugar del editor. */
  automatica: boolean;
  /** Los capítulos escritos (lo guardado en el plan), para no borrarlos sin preguntar. */
  valor: unknown;
  /** Un solo parche: `{seleccion: "manual", capitulos}`, un paso del deshacer. */
  onAplicar: (parche: Record<string, unknown>) => void;
};

type Ui = {
  /** En «Los escribo yo», la propuesta se abre a pedido. */
  abierta: boolean;
  /** Las casillas de una propuesta concreta; con otra propuesta, todas vuelven a marcarse. */
  sel: { datos: Propuesta; marcados: Set<string> } | null;
  /** Lo traído que espera la respuesta a «¿reemplazo o agrego?». */
  pendiente: Record<string, unknown>[] | null;
  aviso: string;
  anuncio: string;
  /** Tras pasar a «Los escribo yo», el foco va a «Traer la propuesta del motor» (el botón pulsado desaparece). */
  enfocar: boolean;
};

const UI_INICIAL: Ui = { abierta: false, sel: null, pendiente: null, aviso: "", anuncio: "", enfocar: false };

export function PropuestaResumen({ slide, scope, automatica, valor, onAplicar }: Props) {
  const idTitulo = useId();
  const idConfirmar = useId();
  const [ui, setUi] = useState<Ui>(UI_INICIAL);
  const cambiar = (p: Partial<Ui>) => setUi((u) => ({ ...u, ...p }));
  const visible = automatica || ui.abierta;
  const { estado, cargar, desactualizada } = usePropuestaResumen(slide, scope, visible);
  const { multi } = useVariables();
  const traer = useRef<HTMLButtonElement>(null);
  const confirmar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ui.enfocar && !automatica) { traer.current?.focus(); setUi((u) => ({ ...u, enfocar: false })); }
  }, [ui.enfocar, automatica]);
  useEffect(() => { if (ui.pendiente) confirmar.current?.focus(); }, [ui.pendiente]);

  const datos = estado.fase === "lista" ? estado.datos : null;
  const marcados = datos ? (ui.sel?.datos === datos ? ui.sel.marcados : todosMarcados(datos)) : new Set<string>();
  const tipo = datos?.tipo ?? (slide.tipo === "p_slide_resumen_diferencias" ? "p_slide_resumen_diferencias" : "p_slide_hallazgos");
  const plural = nombreElemento(tipo, true);

  const aplicar = (capitulos: Record<string, unknown>[]) => {
    const n = capitulos.reduce((k, c) => k + (Array.isArray(c.cifras) ? c.cifras.length : Array.isArray(c.filas) ? c.filas.length : 0), 0);
    onAplicar({ seleccion: "manual", capitulos });
    setUi((u) => ({
      ...u, abierta: false, pendiente: null, aviso: "", enfocar: true,
      anuncio: `En «Los escribo yo» con ${formatoConteo(n)} ${n === 1 ? nombreElemento(tipo) : plural}. Ctrl+Z lo deshace.`,
    }));
  };
  const usarMarcados = () => {
    if (!datos) return;
    const traidos = capitulosDesdePropuesta(datos, marcados, multi);
    if (!traidos.length) {
      cambiar({ aviso: avisoNadaMarcado(tipo), pendiente: null });
      return;
    }
    if (escritosQueSalen(tipo, valor).length) { cambiar({ pendiente: traidos, aviso: "" }); return; }
    aplicar(traidos);
  };
  const resolver = (como: ComoCombinar) => {
    if (ui.pendiente) aplicar(combinarCapitulos(escritosQueSalen(tipo, valor), ui.pendiente, como));
  };

  if (!visible) {
    return (
      <div className="pulso-f6-propuesta-traer">
        <PulsoButton ref={traer} variant="secondary" size="sm" onClick={() => { cambiar({ abierta: true, aviso: "", anuncio: "" }); cargar(); }}>
          <ListChecks size={14} aria-hidden="true" /> Traer la propuesta del motor
        </PulsoButton>
        <span className="pulso-sr-only" aria-live="polite">{ui.anuncio}</span>
      </div>
    );
  }

  const escritos = escritosQueSalen(tipo, valor).length;
  const total = datos ? totalElementos(datos) : 0;
  const quedan = datos ? cuantosQuedan(datos, marcados) : 0;
  const avisos = datos ? avisosPropuesta(datos) : [];

  return (
    <section className="pulso-f6-propuesta" aria-labelledby={idTitulo} data-qa="propuesta-motor"
      data-qa-geometry-group="graficos/f6-propuesta" data-qa-geometry-contract="intrinsic">
      <div className="pulso-f6-propuesta-cabeza" data-qa-geometry-member>
        <h4 id={idTitulo} className="pulso-f6-dato-rotulo">Lo que propone el motor</h4>
        {datos && total > 0 && <span className="pulso-f6-propuesta-n">{conteoQuedan(quedan, total)}</span>}
        {!automatica && (
          <PulsoButton variant="icon" size="sm" aria-label="Cerrar la propuesta" onClick={() => cambiar({ abierta: false, pendiente: null, aviso: "" })}>
            <X size={14} aria-hidden="true" />
          </PulsoButton>
        )}
      </div>
      <div aria-live="polite" className="pulso-f6-propuesta-estado" data-qa-geometry-member>
        {estado.fase === "cargando" && <CargaDeBloque label={`El motor elige ${losElementos(tipo)}. Puede tardar hasta un minuto.`} />}
        {estado.fase === "lista" && <span className="pulso-sr-only">Propuesta lista: {conteoQuedan(quedan, total)}.</span>}
      </div>
      {estado.fase === "error" && (
        <div className="pulso-f6-propuesta-error" data-qa-geometry-member>
          <p className="pulso-f6-propuesta-aviso" role="alert">{estado.mensaje}</p>
          <PulsoButton variant="secondary" size="sm" onClick={cargar}>
            <RefreshCw size={14} aria-hidden="true" /> Reintentar
          </PulsoButton>
        </div>
      )}
      {datos && (
        <>
          {desactualizada && (
            <div className="pulso-f6-propuesta-desfase" data-qa-geometry-member>
              <span className="pulso-f6-dato-ayuda">Cambiaste los ajustes de la lámina. La propuesta puede ser otra.</span>
              <PulsoButton variant="secondary" size="sm" onClick={cargar}>
                <RefreshCw size={14} aria-hidden="true" /> Actualizar
              </PulsoButton>
            </div>
          )}
          {avisos.length > 0 && (
            <div className="pulso-f6-propuesta-avisos" data-qa-geometry-member>
              {avisos.map((a) => <p key={a} className="pulso-f6-propuesta-aviso" role="note">{a}</p>)}
            </div>
          )}
          {total === 0 ? (
            <p className="pulso-f6-dato-ayuda" data-qa-geometry-member data-qa-empty="legitimo">
              Con estos cruces el motor no encuentra {plural} que proponer.
            </p>
          ) : (
            <ol className="pulso-f6-propuesta-capitulos" data-qa-geometry-group="graficos/f6-propuesta-capitulos" data-qa-geometry-contract="intrinsic">
              {vistaPropuesta(datos).map((c, i) => (
                <CapituloPropuesta key={c.clave} titulo={c.titulo || `Capítulo ${i + 1}`} elementos={c.elementos} marcados={marcados}
                  onAlternar={(k) => cambiar({ sel: { datos, marcados: alternar(marcados, k) }, aviso: "" })} />
              ))}
            </ol>
          )}
          {ui.aviso && <p className="pulso-f6-propuesta-aviso" role="alert">{ui.aviso}</p>}
          {ui.pendiente ? (
            <div ref={confirmar} tabIndex={-1} role="group" aria-labelledby={idConfirmar} className="pulso-f6-propuesta-confirmar" data-qa-geometry-member>
              <p id={idConfirmar} className="pulso-f6-propuesta-pregunta">
                Ya hay {formatoConteo(escritos)} {escritos === 1 ? "capítulo escrito" : "capítulos escritos"}. ¿Los reemplazo por lo marcado o lo agrego al final?
              </p>
              <div className="pulso-f6-propuesta-acciones">
                <PulsoButton variant="secondary" size="sm" onClick={() => resolver("reemplazar")}>Reemplazar</PulsoButton>
                <PulsoButton variant="secondary" size="sm" onClick={() => resolver("agregar")}>Agregar al final</PulsoButton>
                <PulsoButton variant="ghost" size="sm" onClick={() => cambiar({ pendiente: null })}>Cancelar</PulsoButton>
              </div>
            </div>
          ) : total > 0 && (
            <div className="pulso-f6-propuesta-acciones" data-qa-geometry-member>
              <PulsoButton variant="primary" size="sm" onClick={usarMarcados}>
                <PencilLine size={14} aria-hidden="true" /> {automatica ? "Editar a partir de esta propuesta" : "Llevar lo marcado al editor"}
              </PulsoButton>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function CapituloPropuesta({ titulo, elementos, marcados, onAlternar }: {
  titulo: string; elementos: ElementoVista[]; marcados: ReadonlySet<string>; onAlternar: (clave: string) => void;
}) {
  const id = useId();
  return (
    <li className="pulso-f6-criterio pulso-f6-propuesta-capitulo" role="group" aria-labelledby={id} data-qa-geometry-member>
      <h5 id={id} className="pulso-f6-propuesta-titulo">{titulo}</h5>
      <ul className="pulso-f6-propuesta-lista" data-qa-geometry-group="graficos/f6-propuesta-lista" data-qa-geometry-contract="intrinsic">
        {elementos.map((e) => <ElementoPropuesta key={e.clave} e={e} queda={marcados.has(e.clave)} onAlternar={() => onAlternar(e.clave)} />)}
      </ul>
    </li>
  );
}

function ElementoPropuesta({ e, queda, onAlternar }: { e: ElementoVista; queda: boolean; onAlternar: () => void }) {
  return (
    <li className={`pulso-f6-propuesta-elemento${queda ? "" : " is-fuera"}`} data-qa-geometry-member>
      <PulsoSwitch className="pulso-f6-propuesta-queda" size="sm" label="Queda" checked={queda} onCheckedChange={onAlternar}
        ariaLabel={`Queda: ${[e.pregunta, `${e.cifra} ${e.frase}`.trim()].filter(Boolean).join(", ")}`} />
      <div className="pulso-f6-propuesta-cuerpo">
        {e.pregunta && <span className="pulso-f6-propuesta-pregunta-corta" title={e.pregunta}>{e.pregunta}</span>}
        <div className="pulso-f6-propuesta-cifra-linea">
          <span className="pulso-f6-propuesta-cifra">{e.cifra || "Sin cifra"}</span>
          <span className="pulso-f6-propuesta-frase">
            {e.frase}
            {e.sinTexto && <span className="pulso-f6-propuesta-marca">Sin texto</span>}
          </span>
        </div>
        {e.diferencia && <span className={`pulso-f6-propuesta-dif is-${e.estado}`}>{e.diferencia}</span>}
        {e.n !== null && <span className="pulso-f6-propuesta-base">Base: {formatoConteo(e.n)}</span>}
      </div>
    </li>
  );
}
