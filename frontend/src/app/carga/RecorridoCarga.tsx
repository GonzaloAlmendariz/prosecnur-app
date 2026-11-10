import { useEffect, useRef, useState, type CSSProperties } from "react";
import { PROSECNUR_MODULES, type ProsecnurModuleMeta, type ProsecnurModuleSlug } from "../../lib/modules";
import { EscenaCarga } from "./EscenaCarga";
import { TRAMO_MS } from "./escenasMotor";
import { ESCENAS_CARGA, type ClaveEscenas } from "./escenasCarga";
import "./recorrido-carga.css";

/**
 * Recorrido de la pantalla de inicio y carga del proyecto (6 nov 2026, propuesta aprobada por Gonzalo). Los siete
 * módulos pasan en orden; cada uno muestra una de sus cinco escenas, elegida al azar y sin repetir la última que
 * mostró. Cada tramo dura una sola pasada de su escena (`TRAMO_MS`, 10 nov 2026: antes la apertura anterior entre
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

/** Índice al azar entre las escenas del módulo, distinto del último que mostró. */
function escenaAlAzar(n: number, ultima: number | undefined): number {
  let i = Math.floor(Math.random() * n);
  if (n > 1 && i === ultima) i = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
  return i;
}

export function RecorridoCarga({ transcurridoMs }: { transcurridoMs: number }) {
  const { indice } = tramoRecorrido(transcurridoMs);
  const ultimas = useRef<Partial<Record<ClaveEscenas, number>>>({});
  const [actual, setActual] = useState<{ paso: number; escena: number; turno: number }>(() => ({ paso: -1, escena: 0, turno: 0 }));

  useEffect(() => {
    if (actual.paso === indice) return;
    const { clave } = PASOS[indice];
    const escena = escenaAlAzar(ESCENAS_CARGA[clave].length, ultimas.current[clave]);
    ultimas.current[clave] = escena;
    setActual((prev) => ({ paso: indice, escena, turno: prev.turno + 1 }));
  }, [indice, actual.paso]);

  if (actual.paso < 0) return <div className="rc-escaparate" />;
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
}

export function SegmentosRecorrido({ transcurridoMs }: { transcurridoMs: number }) {
  const { indice, vuelta, dentro } = tramoRecorrido(transcurridoMs);
  return (
    <div className="rc-segmentos" aria-hidden="true" style={{ "--rc-n": PASOS.length } as CSSProperties}>
      {PASOS.map((paso, i) => {
        const meta = metaDe(paso.slug);
        const Icono = meta?.icon;
        const lleno = i < indice || (vuelta > 0 && i !== indice) ? 1 : i === indice ? dentro : 0;
        const clase = i === indice ? "is-actual" : vuelta > 0 || i < indice ? "is-visto" : undefined;
        return (
          <div key={paso.slug} className={clase} style={{ "--t": meta?.tone.accent ?? "var(--pulso-primary)" } as CSSProperties}>
            <span className="rc-pista"><i style={{ transform: `scaleX(${lleno})` }} /></span>
            {Icono ? <Icono size={16} strokeWidth={2} /> : null}
          </div>
        );
      })}
    </div>
  );
}
