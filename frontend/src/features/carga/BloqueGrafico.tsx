// Elección de gráfico y de corte, por bloque (ADR 0064).
//
// Un bloque son los temas que comparten escala. Por defecto sale como barras
// multiapiladas, que dibujan la distribución entera. Cuando el bloque tiene
// suficientes ejes y todos sus temas cubren los mismos públicos, se puede leer
// mejor como radar — pero un radar necesita UN número por eje y por serie, y ese
// número hay que decidirlo.
//
// El corte se DECLARA aquí y no se deduce: cuál es el indicador —el «Sí», o la
// suma de «De acuerdo» y «Totalmente de acuerdo», dejando fuera el «SIN INF»—
// es una decisión metodológica del estudio, no una propiedad de la escala. Por
// eso son casillas sobre las opciones reales del bloque y no una regla fija:
// «los dos últimos» sería falso en cuanto una escala traiga su «sin
// información» al final, que es justo lo que pasa en el estudio medido.

import { BarChart3, Radar } from "../../vendor/lucide-react";
import type { BloqueEditor } from "./equivalenciasEditorModel";

export type EstiloRadar = { value: string; label: string; hint?: string };

export type BloqueGraficoProps = {
  bloque: BloqueEditor;
  /**
   * Estilos que ofrece el motor. Llegan del backend: uno nuevo aparece aquí sin
   * tocar este archivo, y uno retirado deja de ofrecerse en vez de quedar como
   * opción muerta que dibuja otra cosa.
   */
  estilos?: readonly EstiloRadar[];
  /** Escribe el campo en todas las filas del bloque. */
  onCambiar: (campo: "grafico" | "corte" | "estilo", valor: string) => void;
};

export function BloqueGrafico({ bloque, estilos = [], onCambiar }: BloqueGraficoProps) {
  if (!bloque.ofrecerRadar) return null;

  const esRadar = bloque.grafico === "radar" && bloque.elegibleRadar;
  const alternar = (codigo: string) => {
    const set = new Set(bloque.corte);
    if (set.has(codigo)) set.delete(codigo);
    else set.add(codigo);
    // Se guardan en el orden de la escala, no en el de los clics: el indicador
    // se lee «3 + 4», no «4 + 3».
    const orden = bloque.opciones.map((o) => o.codigo).filter((c) => set.has(c));
    onCambiar("corte", orden.join(","));
  };

  const elegidas = bloque.opciones.filter((o) => bloque.corte.includes(o.codigo));

  return (
    <span className="pulso-equiv-bloque-grafico">
      <span className="pulso-equiv-grafico-switch" role="group" aria-label="Cómo se dibuja este bloque">
        <button
          type="button"
          className={esRadar ? "" : "is-active"}
          aria-pressed={!esRadar}
          onClick={() => onCambiar("grafico", "")}
          title="Barras multiapiladas: dibujan la distribución entera."
        >
          <BarChart3 size={12} aria-hidden="true" />
          Barras
        </button>
        <button
          type="button"
          className={esRadar ? "is-active" : ""}
          aria-pressed={esRadar}
          disabled={!bloque.elegibleRadar}
          onClick={() => onCambiar("grafico", "radar")}
          title={
            bloque.elegibleRadar
              ? "Radar: un eje por tema y una serie por público. Necesita un indicador."
              : `No se puede: ${bloque.motivoNoRadar}.`
          }
        >
          <Radar size={12} aria-hidden="true" />
          Radar
        </button>
      </span>

      {/* Cuando no se puede, el motivo se dice aquí y no sólo en el tooltip: un
          botón apagado sin explicación se lee como algo roto. */}
      {!bloque.elegibleRadar && (
        <span className="pulso-equiv-radar-motivo">{bloque.motivoNoRadar}</span>
      )}

      {esRadar && (
        <span className="pulso-equiv-corte">
          <span className="pulso-equiv-corte-label">Indicador:</span>
          {/* Cada opcion es un boton que se enciende, no una casilla con su
              etiqueta al lado. La casilla duplicaba el estado —el recuadro Y el
              color— y metia un control de 13 px en una fila de pastillas.
              Pulsar «Totalmente de acuerdo» y verlo encendido dice lo mismo con
              la mitad de piezas. */}
          {bloque.opciones.map((o) => {
            const dentro = bloque.corte.includes(o.codigo);
            return (
              <button
                key={o.codigo}
                type="button"
                className={dentro ? "pulso-equiv-corte-op is-on" : "pulso-equiv-corte-op"}
                aria-pressed={dentro}
                onClick={() => alternar(o.codigo)}
              >
                <span className="pulso-equiv-corte-codigo">{o.codigo}</span>
                {o.etiqueta}
              </button>
            );
          })}
          {/* Sin nada elegido no hay indicador y el radar no tiene que dibujar.
              Se dice aqui, donde se decide, y no al generar el mazo. Cuando SI
              hay eleccion no se repite en prosa: los botones encendidos ya lo
              dicen. */}
          {!elegidas.length && (
            <span className="pulso-equiv-corte-falta">
              elige al menos una opción
            </span>
          )}
        </span>
      )}

      {/* El estilo se declara por BLOQUE, junto al corte, porque dice cómo se
          lee ese bloque: una batería de perfil se presenta con líneas y una de
          diagnóstico con la grilla a la vista, y las dos conviven en el mismo
          mazo. Fuera del radar no significa nada, así que no se muestra. */}
      {esRadar && estilos.length > 0 && (
        <span className="pulso-equiv-estilo" role="group" aria-label="Estilo del radar">
          <span className="pulso-equiv-corte-label">Estilo:</span>
          {estilos.map((e) => {
            const activo = (bloque.estilo || estilos[0]?.value) === e.value;
            return (
              <button
                key={e.value}
                type="button"
                className={activo ? "pulso-equiv-estilo-op is-on" : "pulso-equiv-estilo-op"}
                aria-pressed={activo}
                title={e.hint}
                onClick={() => onCambiar("estilo", e.value)}
              >
                {e.label}
              </button>
            );
          })}
        </span>
      )}
    </span>
  );
}
