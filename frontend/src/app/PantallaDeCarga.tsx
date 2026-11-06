import type { CSSProperties, ReactNode } from "react";
import { AlertTriangle, Check, Loader2, Minus } from "lucide-react";
import { BarraDeAvance } from "../components/BarraDeAvance";
import { BootEcualizador } from "./BootEcualizador";
import { WarmupReloj } from "./WarmupReloj";
import type { WarmupEstimacion } from "./warmupTiempo";
import "./pantalla-de-carga.css";

/**
 * La pantalla de carga de la app, una sola (5 nov 2026, Gonzalo: «las ventanas de carga de módulos aún no está
 * estandarizada»). Antes había dos con el mismo propósito y distinto cuerpo: la del proyecto (BootGate, lámina
 * propia, pasos con detalle) y la del módulo (ModuleWarmupBoundary, otra lámina, fases con reloj). Ahora las dos
 * dibujan ESTA: silueta de la vista destino al fondo, y encima una lámina con el isotipo que late, la ceja en el
 * tono del módulo, el titular de la fase, la barra del kit, la lectura (reloj y cifra) y la lista de fases.
 *
 * Lo que varía es el dato, no la forma: quien la monta decide la ceja, el titular, si hay porcentaje medido y
 * qué dice cada fase a la derecha (su reloj o su detalle). Se pinta también desde el chunk de arranque, así que
 * su hoja sólo usa tokens que boot.css replica.
 */
export type FaseDeCargaEstado = "pending" | "running" | "ready" | "skipped" | "timeout" | "error";

export type FaseDeCarga = {
  id: string;
  label: string;
  status: FaseDeCargaEstado;
  /** Lo que se lee a la derecha de la fase: su reloj («0:07»), o un detalle corto («No aplica»). */
  lectura?: string;
};

function IconoFase({ status }: { status: FaseDeCargaEstado }) {
  if (status === "ready") return <Check size={12} strokeWidth={3} aria-hidden="true" />;
  if (status === "running") return <Loader2 size={12} strokeWidth={2.6} className="pulso-carga-fase-giro" aria-hidden="true" />;
  if (status === "skipped") return <Minus size={12} strokeWidth={2.6} aria-hidden="true" />;
  if (status === "timeout" || status === "error") return <AlertTriangle size={11} strokeWidth={2.4} aria-hidden="true" />;
  return null;
}

export function PantallaDeCarga({
  ceja,
  sujeto,
  titulo,
  porcentaje,
  transcurridoMs,
  estimacion,
  fases,
  error,
  fondo,
  alto = "area",
  className,
  style,
  conTono = false,
  datos,
  disposicion = "centro",
  bajoLamina,
}: {
  /** Qué se abre, en versalitas y en el tono del módulo: «Abriendo Validación». */
  ceja: string;
  /** El nombre del proyecto, cuando lo hay. */
  sujeto?: string | null;
  /** La fase en curso, en grande. */
  titulo: string;
  /** Avance medido 0–100. Sin él (o en 0) la barra es indeterminada y no se escribe cifra. */
  porcentaje?: number;
  transcurridoMs: number;
  estimacion: WarmupEstimacion;
  fases?: FaseDeCarga[];
  error?: string;
  /** La silueta de la vista destino (VistaSkeleton). */
  fondo?: ReactNode;
  /** `ventana` ocupa el viewport (arranque del proyecto); `area` ocupa el hueco del módulo. */
  alto?: "ventana" | "area";
  className?: string;
  /** Las variables del tono (`moduleChromeVars`). */
  style?: CSSProperties;
  /** Hay módulo destino: la ceja y la fase en curso toman su tono. */
  conTono?: boolean;
  /** Atributos `data-*` que leen los runners de QA y el puente de navegación. */
  datos?: Record<`data-${string}`, string | number | undefined>;
  /**
   * `centro`: la lámina al medio sobre la silueta. `recorrido` (inicio y carga del proyecto, 6 nov 2026): la lámina
   * en una columna angosta a la izquierda, `bajoLamina` debajo, y el fondo ocupa el resto de la ventana.
   */
  disposicion?: "centro" | "recorrido";
  /** Lo que va debajo de la lámina en la disposición `recorrido` (la barra de módulos). */
  bajoLamina?: ReactNode;
}) {
  const medido = porcentaje !== undefined && porcentaje > 0;
  const cifra = medido ? Math.min(100, Math.round(porcentaje)) : null;
  const detenido = Boolean(error) || Boolean(fases?.some((fase) => fase.status === "error"));
  const clase = ["pulso-carga", `is-${alto}`, disposicion === "recorrido" ? "is-recorrido" : null, conTono ? "has-tono" : null, className].filter(Boolean).join(" ");
  const lamina = (
    <LaminaDeCarga
      ceja={ceja}
      sujeto={sujeto}
      titulo={titulo}
      medido={medido}
      cifra={cifra}
      detenido={detenido}
      transcurridoMs={transcurridoMs}
      estimacion={estimacion}
      fases={fases}
      error={error}
    />
  );
  return (
    <section className={clase} style={style} role="status" aria-live="polite" {...datos}>
      {fondo ? <div className="pulso-carga-fondo" aria-hidden="true">{fondo}</div> : null}
      {disposicion === "recorrido" ? (
        <div className="pulso-carga-columna">
          {lamina}
          {bajoLamina}
        </div>
      ) : lamina}
    </section>
  );
}

function LaminaDeCarga({
  ceja,
  sujeto,
  titulo,
  medido,
  cifra,
  detenido,
  transcurridoMs,
  estimacion,
  fases,
  error,
}: {
  ceja: string;
  sujeto?: string | null;
  titulo: string;
  medido: boolean;
  cifra: number | null;
  detenido: boolean;
  transcurridoMs: number;
  estimacion: WarmupEstimacion;
  fases?: FaseDeCarga[];
  error?: string;
}) {
  return (
    <div className="pulso-carga-lamina">
      <div className="pulso-carga-resumen">
        <BootEcualizador detenido={detenido} />
        <div className="pulso-carga-cabeza">
          <p className="pulso-carga-ceja">{ceja}</p>
          {sujeto ? <p className="pulso-carga-sujeto" title={sujeto}>{sujeto}</p> : null}
          <h1 className="pulso-carga-titulo">{titulo}</h1>
        </div>
        {medido && cifra !== null && cifra < 100
          ? <BarraDeAvance valor={cifra} total={100} etiqueta={`Avance: ${ceja}`} />
          : <BarraDeAvance indeterminada etiqueta={ceja} />}
        <div className="pulso-carga-lectura">
          <WarmupReloj className="pulso-carga-reloj" transcurridoMs={transcurridoMs} estimacion={estimacion} />
          {cifra !== null ? <span className="pulso-carga-cifra">{cifra}%</span> : null}
        </div>
      </div>
      {fases?.length ? (
        <ol className="pulso-carga-fases" aria-label="Fases" aria-live="off">
          {fases.map((fase) => (
            <li className={`pulso-carga-fase is-${fase.status}`} key={fase.id}>
              <span className="pulso-carga-fase-icono" aria-hidden="true">
                <IconoFase status={fase.status} />
              </span>
              <strong>{fase.label}</strong>
              <small>{fase.lectura ?? ""}</small>
            </li>
          ))}
        </ol>
      ) : null}
      {error ? <p className="pulso-carga-error">{error}</p> : null}
    </div>
  );
}

export default PantallaDeCarga;
