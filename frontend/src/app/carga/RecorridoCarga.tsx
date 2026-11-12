import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { PROSECNUR_MODULES, type ProsecnurModuleMeta, type ProsecnurModuleSlug } from "../../lib/modules";
import { EscenaCarga } from "./EscenaCarga";
import { TRAMO_MS } from "./escenasMotor";
import { ESCENAS_CARGA, type ClaveEscenas } from "./escenasCarga";
import "./recorrido-carga.css";

/**
 * Recorrido de la pantalla de inicio y carga del proyecto (6 nov 2026, propuesta aprobada por Gonzalo). Los siete
 * módulos pasan en orden; cada uno muestra una de sus cinco escenas, sacada de una bolsa barajada (las cinco salen antes
 * de repetir). Cada tramo dura una sola pasada de su escena (`TRAMO_MS`, 10 nov 2026: antes la apertura anterior entre
 * siete, de 3 a 9 s, y en cargas largas la misma escena se veía dos veces); si la carga sigue, el recorrido da otra
 * vuelta. `RecorridoCarga` es el escaparate (fondo de PantallaDeCarga) y
 * `SegmentosRecorrido` la barra que va debajo de la lámina; los dos calculan el mismo tramo a partir del tiempo.
 */
type PasoRecorrido = { clave: ClaveEscenas; slug: ProsecnurModuleSlug; descripcion: string };

const PASOS: readonly PasoRecorrido[] = [
  { clave: "calc", slug: "calc-muestra", descripcion: "Marco, tamaño de muestra y sorteo." },
  { clave: "form", slug: "editor-xlsform", descripcion: "Cuestionario en XLSForm, condiciones y validaciones." },
  { clave: "rutas", slug: "hojas-ruta", descripcion: "Distritos, sorteo de manzanas y rutas de campo." },
  { clave: "material", slug: "material-campo", descripcion: "Fichas, códigos QR y paquetes por campaña." },
  { clave: "monitoreo", slug: "monitoreo", descripcion: "Avance del campo contra la meta y su consistencia." },
  { clave: "proc", slug: "procesamiento", descripcion: "Validación, codificación, tablas e informe." },
  { clave: "dash", slug: "dashboard", descripcion: "Tablero interactivo y editable para el cliente." },
];

export function tramoRecorrido(transcurridoMs: number) {
  const t = Math.max(0, transcurridoMs);
  return {
    indice: Math.floor(t / TRAMO_MS) % PASOS.length,
    vuelta: Math.floor(t / TRAMO_MS / PASOS.length),
    dentro: (t % TRAMO_MS) / TRAMO_MS,
  };
}

function metaDe(slug: ProsecnurModuleSlug): ProsecnurModuleMeta | undefined {
  return PROSECNUR_MODULES.find((m) => m.slug === slug);
}

function nombreDe(meta: ProsecnurModuleMeta | undefined): string {
  return meta ? meta.cardTitle ?? meta.shortLabel : "";
}

/**
 * 12 nov 2026 (Gonzalo: "para hojas de ruta solo repite dos animaciones"). Antes se elegía al azar excluyendo sólo la
 * última, así que dos escenas podían alternarse vuelta tras vuelta. Ahora cada módulo saca de una bolsa barajada: las
 * cinco salen una vez antes de repetir, y la bolsa vive a nivel de módulo para que un remontaje no la reinicie.
 */
const bolsas: Partial<Record<ClaveEscenas, number[]>> = {};
const ultimaEscena: Partial<Record<ClaveEscenas, number>> = {};
let ultimoTurno: { turno: number; escena: number } | null = null;

/** La escena de un tramo. Idempotente por turno: StrictMode renderiza dos veces y no debe sacar dos de la bolsa. */
export function escenaDelTurno(clave: ClaveEscenas, n: number, turno: number): number {
  if (ultimoTurno?.turno === turno) return ultimoTurno.escena;
  const escena = siguienteEscena(clave, n);
  ultimoTurno = { turno, escena };
  return escena;
}

export function siguienteEscena(clave: ClaveEscenas, n: number, azar: () => number = Math.random): number {
  let bolsa = bolsas[clave];
  if (!bolsa || bolsa.length === 0) {
    bolsa = Array.from({ length: n }, (_, i) => i);
    for (let i = bolsa.length - 1; i > 0; i--) {
      const j = Math.floor(azar() * (i + 1));
      [bolsa[i], bolsa[j]] = [bolsa[j], bolsa[i]];
    }
    // Al rebarajar, que la primera de la bolsa nueva no sea la última de la anterior.
    if (n > 1 && bolsa[bolsa.length - 1] === ultimaEscena[clave]) [bolsa[0], bolsa[bolsa.length - 1]] = [bolsa[bolsa.length - 1], bolsa[0]];
    bolsas[clave] = bolsa;
  }
  const escena = bolsa.pop() as number;
  ultimaEscena[clave] = escena;
  return escena;
}

/** Sólo para pruebas: vacía las bolsas. */
export function reiniciarBolsasEscenas() {
  for (const clave of Object.keys(bolsas) as ClaveEscenas[]) delete bolsas[clave];
  for (const clave of Object.keys(ultimaEscena) as ClaveEscenas[]) delete ultimaEscena[clave];
  ultimoTurno = null;
}

/**
 * El tramo en curso con su propio reloj (12 nov 2026, Gonzalo: "se traba en la transición"). El reloj de la lámina
 * late cada segundo y el tramo dura 3.76 s: derivar el cambio de escena de ese latido lo retrasaba hasta un segundo,
 * de modo que unas escenas quedaban en blanco casi un segundo y otras se cortaban antes de terminar. Aquí el
 * transcurrido sólo fija el origen al montar; el cambio se agenda en el instante exacto del borde del tramo.
 */
function useTramo(transcurridoMs: number) {
  const origen = useRef<number | null>(null);
  // El origen se alinea al inicio del tramo en curso: si se monta a mitad de uno, ese tramo empieza ahora entero, en
  // vez de cortar la escena recién montada cuando el tramo termine.
  if (origen.current === null) {
    const t = Math.max(0, transcurridoMs);
    origen.current = Date.now() - (t - (t % TRAMO_MS));
  }
  const [tramo, setTramo] = useState(() => tramoRecorrido(Date.now() - (origen.current as number)));
  useEffect(() => {
    let timer = 0;
    const agendar = () => {
      const t = Date.now() - (origen.current as number);
      timer = window.setTimeout(() => {
        setTramo(tramoRecorrido(Date.now() - (origen.current as number) + 1));
        agendar();
      }, TRAMO_MS - (t % TRAMO_MS));
    };
    agendar();
    return () => window.clearTimeout(timer);
  }, []);
  return tramo;
}

export function RecorridoCarga({ transcurridoMs }: { transcurridoMs: number }) {
  const { indice, vuelta } = useTramo(transcurridoMs);
  return <EscaparateRecorrido indice={indice} vuelta={vuelta} />;
}

/** Memorizado: el reloj de la lámina re-renderiza cada segundo, y la escena sólo debe tocarse al cambiar de tramo. */
const EscaparateRecorrido = memo(function EscaparateRecorrido({ indice, vuelta }: { indice: number; vuelta: number }) {
  // La escena se elige en el mismo render que cambia el tramo (antes en un efecto posterior: un render de más y, al
  // montar, un cuadro con el escaparate vacío).
  const actual = useMemo(() => {
    const { clave } = PASOS[indice];
    const turno = vuelta * PASOS.length + indice;
    return { paso: indice, escena: escenaDelTurno(clave, ESCENAS_CARGA[clave].length, turno), turno };
  }, [indice, vuelta]);
  const paso = PASOS[actual.paso];
  const meta = metaDe(paso.slug);
  const Icono = meta?.icon;
  const escena = ESCENAS_CARGA[paso.clave][actual.escena];
  const tono = { "--rc-tono": meta?.tone.accent ?? "var(--pulso-primary)" } as CSSProperties;

  return (
    <div className="rc-escaparate" style={tono} data-recorrido-modulo={paso.slug}>
      <div className="rc-ambiente" />
      <div className="rc-identidad" key={`id-${actual.turno}`}>
        <small>
          <span>{Icono ? <Icono size={16} strokeWidth={2} aria-hidden="true" /> : null}</span>
          Módulo {actual.paso + 1} de {PASOS.length}
        </small>
        <h2>{nombreDe(meta)}</h2>
        <p>{paso.descripcion}</p>
      </div>
      <div className="rc-lienzo" key={`lienzo-${actual.turno}`}>
        <div className="rc-lienzo-cab">
          <span className="rc-chip">{Icono ? <Icono size={16} strokeWidth={2} aria-hidden="true" /> : null}</span>
          <span className="rc-eb">{nombreDe(meta)} › {escena.donde}</span>
          <span className="rc-tt">{escena.titulo}</span>
        </div>
        <EscenaCarga clave={paso.clave} indice={actual.escena} repetir={false} />
      </div>
    </div>
  );
});

export function SegmentosRecorrido({ transcurridoMs }: { transcurridoMs: number }) {
  const { indice, vuelta } = useTramo(transcurridoMs);
  return <BarraSegmentos indice={indice} vuelta={vuelta} />;
}

/**
 * La pista del módulo actual se llena con una animación CSS de un tramo (antes, una transición de 1 s por cada latido
 * del reloj: avanzaba a saltos y quedaba desfasada de la escena). La animación es de `transform`, así que corre en el
 * compositor aunque el hilo principal esté ocupado cargando el proyecto.
 */
const BarraSegmentos = memo(function BarraSegmentos({ indice, vuelta }: { indice: number; vuelta: number }) {
  return (
    <div className="rc-segmentos" aria-hidden="true" style={{ "--rc-n": PASOS.length } as CSSProperties}>
      {PASOS.map((paso, i) => {
        const meta = metaDe(paso.slug);
        const Icono = meta?.icon;
        const actual = i === indice;
        const lleno = actual ? undefined : i < indice || vuelta > 0 ? 1 : 0;
        const clase = actual ? "is-actual" : vuelta > 0 || i < indice ? "is-visto" : undefined;
        return (
          <div key={paso.slug} className={clase} style={{ "--t": meta?.tone.accent ?? "var(--pulso-primary)" } as CSSProperties}>
            <span className="rc-pista">
              <i key={actual ? `${vuelta}-${indice}` : "quieta"} style={actual ? { "--rc-tramo": `${TRAMO_MS}ms` } as CSSProperties : { transform: `scaleX(${lleno})` }} />
            </span>
            {Icono ? <Icono size={16} strokeWidth={2} /> : null}
          </div>
        );
      })}
    </div>
  );
});
