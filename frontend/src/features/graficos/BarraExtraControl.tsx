// Control único de la «Barra extra»: un interruptor y, encendido, chips de multiselección con lo que muestra la columna
// (Top Two Box, Bottom Two Box, Conteos). Lo usan el bloque de la multiapilada, la tarjeta del gráfico y el modelo del
// Word; el valor y sus reglas viven en `barraExtra.ts`, y quien lo monta decide dónde se guarda.
//
// Contrato de Superficie: superficie intrínseca (grupo `graficos/barra-extra`); el marco no depende de cuántas opciones
// o categorías haya (los chips envuelven), el vacío (cargando, error, sin escala, categorías por elegir) vive dentro del
// propio control (C3/C5) y nada se recorta (C4: el scroll es del contenedor que lo aloja).

import { useId, useState } from "react";
import { Loader2, RefreshCw } from "../../vendor/lucide-react";
import { Switch } from "../../components/Switch";
import {
  alternarOpcion,
  AYUDA_OPCION,
  encenderBarraExtra,
  estadoOpcion,
  opcionesActivas,
  OPCIONES_BARRA_EXTRA,
  ROTULO_OPCION,
  type BarraExtra,
  type OpcionBarraExtra,
} from "./barraExtra";
import { Top2BoxSelector } from "./Top2BoxSelector";
import "./BarraExtraControl.css";

/** De dónde salen las categorías de los boxes, o por qué no hay. */
export type EscalaBarraExtra =
  | { fase: "lista"; categorias: string[] }
  | { fase: "cargando" }
  | { fase: "error"; mensaje: string; reintentar: () => void }
  | { fase: "sin_escala"; mensaje: string }
  /** Se eligen en otro lugar (el Word usa las del PPT; la multilista, las de cada bloque). */
  | { fase: "externa"; nota: string };

type CajaBox = "top2box" | "bottom2box";

type Props = {
  valor: BarraExtra;
  onChange: (valor: BarraExtra) => void;
  escala: EscalaBarraExtra;
  /** Las categorías elegidas de cada box; sin ellas (`undefined`) no se sabe cuáles hay y no se avisa de su falta. */
  etiquetas: { top2box?: readonly string[]; bottom2box?: readonly string[] };
  onEtiquetas?: (caja: CajaBox, etiquetas: string[]) => void;
  /** Texto de «de dónde viene» cuando el valor se hereda (estilo del informe, lámina, PPT). */
  heredada?: string;
  /** Si el Bottom Two Box no se puede encender aquí, la razón (y el chip queda inactivo salvo que ya esté elegido). */
  bottomBloqueado?: string;
  /** Las categorías de la caja vienen del estilo del informe. */
  categoriasDelInforme?: { top2box?: boolean; bottom2box?: boolean };
  rotulo?: string;
  ayuda?: string;
  ariaLabel?: string;
  /** Acción para volver a lo heredado (p. ej. «Usar la del PPT»). */
  restablecer?: { rotulo: string; onClick: () => void };
  /** Marca de pruebas/QA para distinguir instancias. */
  qa?: string;
};

export function BarraExtraControl({
  valor, onChange, escala, etiquetas, onEtiquetas, heredada, bottomBloqueado, categoriasDelInforme,
  rotulo = "Barra extra", ayuda = "Muestra una columna a la derecha de cada barra.", ariaLabel, restablecer, qa = "barra-extra",
}: Props) {
  const id = useId();
  // Quitar la última opción deja la barra apagada para el motor, pero el control sigue abierto para poder elegir otra
  // (p. ej. pasar de un box a Conteos, que no se combinan): es lo único que vive aquí; el valor es de quien lo monta.
  const [abierta, setAbierta] = useState(false);
  const encendida = valor !== false || abierta;
  const activas = opcionesActivas(valor);
  const hayConflicto = OPCIONES_BARRA_EXTRA.some((o) => estadoOpcion(valor, o).deshabilitada);
  const nombre = ariaLabel ?? rotulo;

  const alEncender = () => {
    setAbierta(false);
    onChange(encendida ? false : encenderBarraExtra(escala.fase !== "sin_escala"));
  };
  const alElegir = (o: OpcionBarraExtra) => {
    const siguiente = alternarOpcion(valor, o);
    setAbierta(siguiente === false);
    onChange(siguiente);
  };
  const bloqueada = (o: OpcionBarraExtra) => o === "bottom2box" && !!bottomBloqueado && !activas.includes(o);

  return (
    <div className="pulso-barra-extra" role="group" aria-labelledby={`${id}-rotulo`} data-qa={qa}
      data-qa-geometry-group="graficos/barra-extra" data-qa-geometry-contract="intrinsic">
      <div className="pulso-barra-extra-cabeza">
        <span className="pulso-barra-extra-rotulo" id={`${id}-rotulo`}>{rotulo}</span>
        <Switch checked={encendida} ariaLabel={nombre} onToggle={alEncender} />
        <span className="pulso-barra-extra-ayuda">{ayuda}</span>
      </div>

      {encendida && (
        <>
          <div role="group" aria-label={`Qué muestra la ${rotulo.toLowerCase()}`} className="pulso-barra-extra-chips" data-qa={`${qa}-opciones`}>
            {OPCIONES_BARRA_EXTRA.map((o) => {
              const e = estadoOpcion(valor, o);
              const inactivo = e.deshabilitada || bloqueada(o);
              return (
                <button
                  key={o}
                  type="button"
                  className="pulso-barra-extra-chip"
                  aria-pressed={e.activa}
                  disabled={inactivo}
                  title={e.motivo ?? (bloqueada(o) ? bottomBloqueado : AYUDA_OPCION[o])}
                  onClick={() => alElegir(o)}
                >
                  {ROTULO_OPCION[o]}
                </button>
              );
            })}
          </div>
          {valor === false && <p className="pulso-barra-extra-nota" role="status" data-qa={`${qa}-sin-opcion`}>Elige qué muestra la columna; mientras no elijas nada, no sale.</p>}
          {hayConflicto && <p className="pulso-barra-extra-nota" data-qa={`${qa}-exclusion`}>Conteos va solo: no se combina con el Top ni el Bottom Two Box.</p>}
          {bottomBloqueado && !activas.includes("bottom2box") && <p className="pulso-barra-extra-nota">{bottomBloqueado}</p>}
          {activas.length > 0 && !activas.some((o) => o !== "conteos") && <p className="pulso-barra-extra-nota">{AYUDA_OPCION.conteos}</p>}
          {activas.filter((o): o is CajaBox => o !== "conteos").map((caja) => (
            <CategoriasDeBox
              key={caja}
              caja={caja}
              escala={escala}
              etiquetas={etiquetas[caja]}
              delInforme={categoriasDelInforme?.[caja] === true}
              onChange={onEtiquetas ? (e) => onEtiquetas(caja, e) : undefined}
            />
          ))}
        </>
      )}

      {heredada && <p className="pulso-barra-extra-nota" data-qa={`${qa}-heredada`}>{heredada}</p>}
      {restablecer && (
        <button type="button" className="pulso-f6-texto-boton pulso-barra-extra-restablecer" onClick={restablecer.onClick}>{restablecer.rotulo}</button>
      )}
    </div>
  );
}

function CategoriasDeBox({ caja, escala, etiquetas, delInforme, onChange }: {
  caja: CajaBox; escala: EscalaBarraExtra; etiquetas: readonly string[] | undefined; delInforme: boolean; onChange?: (e: string[]) => void;
}) {
  const nombre = ROTULO_OPCION[caja];
  const sinCategorias = etiquetas !== undefined && etiquetas.length === 0;
  // El motor omite una columna de box sin categorías declaradas: se dice junto a lo que falta.
  const aviso = sinCategorias ? (
    <p className="pulso-barra-extra-estado is-pendiente" role="status" data-qa="barra-extra-sin-categorias">
      Sin categorías elegidas: la columna {nombre} no sale hasta que elijas al menos una.
    </p>
  ) : null;

  if (escala.fase === "cargando") {
    return <p className="pulso-barra-extra-estado" role="status"><Loader2 size={13} className="pulso-spin" aria-hidden="true" /> Leyendo la escala de la pregunta…</p>;
  }
  if (escala.fase === "error") {
    return (
      <p className="pulso-barra-extra-estado is-error" role="alert">
        {escala.mensaje}{" "}
        <button type="button" className="pulso-f6-texto-boton" onClick={escala.reintentar}><RefreshCw size={12} aria-hidden="true" /> Reintentar</button>
      </p>
    );
  }
  if (escala.fase === "sin_escala") return <p className="pulso-barra-extra-estado">{escala.mensaje}</p>;
  if (escala.fase === "externa" || !onChange) {
    return (
      <>
        <p className="pulso-barra-extra-estado">{escala.fase === "externa" ? escala.nota : "Las categorías se eligen en otro lugar."}</p>
        {aviso}
      </>
    );
  }
  if (escala.categorias.length <= 2) {
    // `.box_decidir` no dibuja un box que cubre la escala entera («cubre_escala»): sería 100 % en todas las filas.
    const n = escala.categorias.length;
    return <p className="pulso-barra-extra-estado">{n === 0 ? `La pregunta no tiene una escala con categorías: no hay ${nombre} que sumar.` : `Con ${n === 1 ? "una categoría" : "dos categorías"} el ${nombre} sumaría la escala entera: el motor no lo dibuja.`}</p>;
  }
  return (
    <div className="pulso-barra-extra-categorias" data-qa={`barra-extra-categorias-${caja}`}>
      <Top2BoxSelector nombre={nombre as "Top Two Box" | "Bottom Two Box"} categorias={escala.categorias} seleccion={[...(etiquetas ?? [])]} onChange={onChange} />
      {aviso}
      {delInforme && <span className="pulso-barra-extra-nota">Las categorías vienen del estilo del informe; elegir otras las cambia solo aquí.</span>}
    </div>
  );
}
