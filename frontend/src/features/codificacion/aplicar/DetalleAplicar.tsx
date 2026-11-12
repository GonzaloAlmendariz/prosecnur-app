// El detalle de la pregunta elegida: su ficha, la columna de hoy y lo que se agrega, y la tabla de
// sus códigos (código, categoría, origen y respuestas). Es el desglose por código:
// los totales de la pregunta están en su fila de la lista y aquí no se repiten.
//
// La tabla es una rejilla con roles de tabla, como la vista de tabla de Codificar,
// y no `PulsoTable`: la categoría tiene que leerse entera y partir en renglones
// (PulsoTable deja una línea por celda), las columnas reparten el ancho del panel
// (PulsoTable las fija en px) y el dueño del scroll es el panel, sin tope propio.
//
// C1: el cuerpo de la tabla es el contenedor de datos y declara su contrato. La
// tabla es la dueña del scroll de este panel y su cabecera queda fija; como no
// tiene controles dentro, recibe el foco para desplazarla con el teclado.

import { useEffect, useState, type CSSProperties } from "react";
// El relleno de las barras usa la secuencia de datos (--pulso-data-seq-*), que vive en tokens-datos.css y no
// es global: sin este import las barras quedan transparentes.
import "../../../app/tokens-datos.css";
import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import { RespuestasDeAplicar } from "./RespuestasDeAplicar";

import type { PlanPregunta } from "../../../api/dashboard";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { ArrowRight, Tags } from "../../../vendor/lucide-react";
import { FichaDePlan } from "./FichaDePlan";
import { cambioDeLaBase, codigosDeDetalle, etiquetaDePregunta, ROTULO_DE_ORIGEN, tipoDeFicha } from "./modeloAplicar";
import { PanelAplicar } from "./PanelAplicar";
import { NombreDeCampo } from "./NombreDeCampo";

const VISTAS_DEL_DETALLE = [
  { id: "codigos", rotulo: "Códigos" },
  { id: "respuestas", rotulo: "Respuestas" },
] as const;

export function DetalleAplicar({ id, pregunta, vistaPedida }: {
  id: string;
  pregunta: PlanPregunta;
  /** "Ver qué cambia" de la franja pide la vista de Respuestas; cada pedido es un número nuevo. */
  vistaPedida?: number;
}) {
  const codigos = codigosDeDetalle(pregunta);
  const cambio = cambioDeLaBase(pregunta);
  // Códigos o Respuestas (prototipo). Una agrupación de categorías no tiene textos que mostrar.
  const [vista, setVista] = useState<"codigos" | "respuestas">("codigos");
  useEffect(() => {
    if (vistaPedida) setVista("respuestas");
  }, [vistaPedida]);
  const conRespuestas = pregunta.tipo !== "agrupacion";
  const enRespuestas = conRespuestas && vista === "respuestas";
  return (
    <PanelAplicar
      id={id}
      variante="detalle"
      titulo={etiquetaDePregunta(pregunta)}
      icono={<Tags size={16} />}
      aria-label={`Códigos de ${pregunta.parent}`}
      acciones={conRespuestas ? (
        <GlidingRadioGroup
          value={vista}
          options={VISTAS_DEL_DETALLE}
          getOptionValue={(o) => o.id}
          onValueChange={setVista}
          className="pulso-ct-vista"
          aria-label="Qué se ve de la pregunta"
        >
          {(o) => <span>{o.rotulo}</span>}
        </GlidingRadioGroup>
      ) : undefined}
    >
      <div className="pulso-aplicar-detalle-cab">
        <FichaDePlan tipo={tipoDeFicha(pregunta.tipo)} codigo={pregunta.parent} etiqueta={etiquetaDePregunta(pregunta)} />
        {cambio ? (
          // Antes y después (`pp-cambio` del prototipo): la columna que la base trae hoy y lo que se agrega.
          // C1: los dos lados son pares (antes y después) y comparten el alto.
          <div className="pulso-aplicar-cambio" role="group" aria-label="Qué cambia en la base" data-qa-geometry-group="codificacion/aplicar-cambio" data-qa-geometry-contract="equal">
            <div className="pulso-aplicar-cambio-lado" data-qa-geometry-member="">
              <small>Hoy en la base</small>
              <code title={cambio.hoy}>{cambio.hoy}</code>
              <span>{cambio.hoyTipo}</span>
            </div>
            <ArrowRight size={18} aria-hidden="true" className="pulso-aplicar-cambio-flecha" />
            <div className="pulso-aplicar-cambio-lado" data-agrega="" data-qa-geometry-member="">
              <small>Se agrega</small>
              <NombreDeCampo className="pulso-aplicar-campo" nombre={cambio.agrega} titulo={cambio.agregaTitulo} />
              {/* Cuántos códigos lleva ya lo dicen su fila y la tabla de abajo: aquí no se repite. */}
              <span>{cambio.agregaTipo}</span>
            </div>
          </div>
        ) : null}
      </div>
      {enRespuestas ? (
        <RespuestasDeAplicar parent={pregunta.parent} />
      ) : codigos.length > 0 ? (
        <div
          className="pulso-aplicar-codigos"
          role="table"
          aria-label={`Códigos de ${pregunta.parent}`}
          aria-rowcount={codigos.length + 1}
          tabIndex={0}
        >
          <div role="rowgroup" className="pulso-aplicar-codigos-cab">
            <div role="row" className="pulso-aplicar-codigos-fila">
              <span role="columnheader" className="pulso-aplicar-col-codigo">Código</span>
              <span role="columnheader" className="pulso-aplicar-col-categoria">Categoría</span>
              <span role="columnheader" className="pulso-aplicar-col-origen">Origen</span>
              <span role="columnheader" className="pulso-aplicar-col-respuestas">Respuestas</span>
            </div>
          </div>
          <div
            role="rowgroup"
            className="pulso-aplicar-codigos-cuerpo"
            data-qa-geometry-group="codificacion/aplicar-codigos"
            data-qa-geometry-contract="intrinsic"
          >
            {codigos.map((c) => (
              <div key={c.id} role="row" className="pulso-aplicar-codigos-fila pulso-aplicar-codigo" data-origen={c.origen}>
                <code role="cell" className="pulso-aplicar-col-codigo">{c.codigo}</code>
                <span role="cell" className="pulso-aplicar-col-categoria" data-sin-etiqueta={c.etiqueta ? undefined : ""}>
                  {c.etiqueta || "Sin etiqueta"}
                </span>
                <span role="cell" className="pulso-aplicar-col-origen">
                  <span className="pulso-aplicar-origen">{ROTULO_DE_ORIGEN[c.origen]}</span>
                </span>
                <span role="cell" className="pulso-aplicar-col-respuestas">
                  {/* La barra acompaña a la cifra, que es el dato: sin respuestas no hay barra. */}
                  <span className="pulso-aplicar-barra" aria-hidden="true">
                    {c.proporcion > 0 ? (
                      <span style={{ "--pulso-aplicar-proporcion": String(c.proporcion) } as CSSProperties} />
                    ) : null}
                  </span>
                  <span className="pulso-aplicar-cifra">{c.respuestas}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EstadoVacio
          icono={<Tags size={16} />}
          titulo="Sin desglose por código"
          descripcion="No se recibió la lista de códigos de esta pregunta."
        />
      )}
    </PanelAplicar>
  );
}
