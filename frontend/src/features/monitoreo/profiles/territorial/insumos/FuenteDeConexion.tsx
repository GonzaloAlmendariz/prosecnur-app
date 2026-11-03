// Insumos › Conexiones, las piezas de la vista (pasada de diseño de Material, 3 nov
// 2026): cada fuente es un `Panel` del kit con su estado y sus acciones en la
// cabecera, el formulario y sus metadatos en la línea de `hint`, las cifras en
// `CifrasEnTarjeta` y las lecturas en una tira compacta. La muestra de campo es
// otro `Panel` con sus cuatro cifras. Modelo puro en `conexionesTablero.ts`.

import type { CSSProperties } from "react";
import { ClipboardList, Database, FileSpreadsheet, MapPinned, RefreshCw, RotateCcw, Settings2 } from "lucide-react";
import { CifrasEnTarjeta } from "../../../../../components/CifrasEnTarjeta";
import { EstadoChip } from "../../../../../components/EstadoChip";
import { Panel } from "../../../../../components/Panel";
import { PulsoButton } from "../../../../../components/PulsoButton";
import type { MuestraEnviada } from "../../../../../api/monitoreoMuestraEnviada";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import { AvisoDeMuestraEnviada } from "./AvisoDeMuestraEnviada";
import type { CifraDeFuente } from "./conexionesModel";
import type { FuenteDelTablero, IconoDeFuente, TiraDeLecturas } from "./conexionesTablero";

const ICONO: Record<IconoDeFuente, typeof Database> = { kobo: Database, ocurrencias: ClipboardList, hoja: FileSpreadsheet };

function Tira({ tira }: { tira: TiraDeLecturas }) {
  return (
    <figure className="mon-con-tira">
      <figcaption>
        <span className="mon-con-tira-rotulo">Respuestas por lectura</span>
        <span>{tira.resumen}</span>
      </figcaption>
      <span
        className="mon-con-tira-barras"
        role="img"
        aria-label={`Respuestas por lectura: ${tira.resumen}`}
        style={{ "--mon-con-lecturas": String(tira.alturas.length) } as CSSProperties}
      >
        {tira.alturas.map((altura, indice) => (
          <i key={indice} style={{ "--mon-con-altura": String(altura) } as CSSProperties} />
        ))}
      </span>
    </figure>
  );
}

export function FuenteDeConexion({
  fuente,
  conRotulo,
  ocupado,
  onTraerNuevas,
  onTraerTodo,
  onAdministrar,
}: {
  fuente: FuenteDelTablero;
  conRotulo: boolean;
  ocupado: boolean;
  onTraerNuevas?: () => void;
  onTraerTodo?: () => void;
  onAdministrar?: () => void;
}) {
  const Icono = ICONO[fuente.icono];
  return (
    <Panel
      className={`mon-con-fuente${fuente.discreta ? " es-discreta" : ""}${fuente.traer ? " es-activa" : ""}`}
      variant={fuente.discreta ? "subtle" : "content"}
      aria-label={fuente.titulo}
      data-qa-geometry-member
      eyebrow={conRotulo ? <RotuloDePestana /> : undefined}
      title={<><Icono size={16} aria-hidden="true" />{fuente.titulo}</>}
      hint={
        <>
          <span className={fuente.formularioEnMayusculas ? "mon-con-formulario es-versal" : "mon-con-formulario"}>{fuente.formulario}</span>
          {fuente.metadatos ? <span className="mon-con-metadatos">{fuente.metadatos}</span> : null}
        </>
      }
      actions={
        <>
          <EstadoChip label={fuente.estado} tone={fuente.tono} />
          {onTraerNuevas ? (
            <PulsoButton variant="primary" size="sm" disabled={ocupado} onClick={onTraerNuevas}>
              <RefreshCw size={14} aria-hidden="true" />Traer nuevas
            </PulsoButton>
          ) : null}
          {onTraerTodo ? (
            <PulsoButton variant="secondary" size="sm" disabled={ocupado} onClick={onTraerTodo}>
              <RotateCcw size={14} aria-hidden="true" />Traer todo de nuevo
            </PulsoButton>
          ) : null}
          {onAdministrar ? (
            <PulsoButton variant={fuente.discreta ? "ghost" : "secondary"} size="sm" onClick={onAdministrar}>
              <Settings2 size={14} aria-hidden="true" />Releer ficha o cambiar formulario…
            </PulsoButton>
          ) : null}
        </>
      }
    >
      <div className="mon-con-cuerpo">
        <CifrasEnTarjeta cifras={fuente.cifras} />
        {fuente.tira ? <Tira tira={fuente.tira} /> : null}
      </div>
    </Panel>
  );
}

export function MuestraDeCampo({
  cifras,
  muestraEnviada,
  onAbrirHojas,
  onReenviar,
}: {
  cifras: readonly CifraDeFuente[];
  muestraEnviada: MuestraEnviada | null;
  onAbrirHojas: () => void;
  onReenviar: () => void;
}) {
  return (
    <Panel
      className="mon-con-muestra"
      aria-label="Muestra de campo"
      data-qa-geometry-member="muestra"
      title={<><MapPinned size={16} aria-hidden="true" />Muestra de campo</>}
      hint="Viene de Hojas de ruta."
    >
      <CifrasEnTarjeta cifras={cifras} />
      <AvisoDeMuestraEnviada muestra={muestraEnviada} onAbrirHojas={onReenviar} />
      <PulsoButton variant="secondary" size="sm" nav className="mon-con-abrir" onClick={onAbrirHojas}>Abrir Hojas de ruta</PulsoButton>
    </Panel>
  );
}
