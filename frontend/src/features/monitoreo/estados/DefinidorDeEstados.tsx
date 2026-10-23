// Definidor de estados telefónicos.
//
// Vive fuera de los perfiles porque el dato es de los dos: Acreditación monta
// este definidor en su mesa de teléfono y Telefónico usa el mismo borrador
// (`useDeclaracionDeEstados`) en Insumos › Estados. Era el mismo
// trabajo —confirmar qué significa cada estado que escribió el cliente— y
// tenerlo dentro de `profiles/acreditacion/` obligaba al otro perfil a importar
// del vecino o a escribir su copia.
//
// El catálogo de familias lo acompaña (`familiasDeLlamada.ts`): mientras vivía
// en `profiles/acreditacion/`, montar esto en telefónico violaba el contrato de
// frontera entre perfiles (`profiles/profileImports.test.ts`).
//
// La hoja de barrido la escribe el cliente y su vocabulario cambia entre
// estudios: en `acrconta` conviven once categorías, incluida «Número
// Incorrrecto» con tres erres. Hasta ahora una heurística de regex las
// clasificaba sola, sin que nadie pudiera confirmarla ni corregirla, y los
// colores estaban escritos a mano en el `style` de cada vista.
//
// Esta pantalla hace tres cosas, y ninguna es cosmética:
//
//   1. Muestra lo que la app encontró de verdad en ESTE corte, con su volumen.
//   2. Deja corregir a qué familia va cada etiqueta cuando la heurística falla.
//      Lo confirmado gana siempre sobre lo inferido, también en cortes futuros.
//   3. Fija el color de cada familia, que es lo que permite distinguirlas en el
//      apilado diario. Once categorías con colores casi iguales fue el defecto
//      original de la franja de estados.
//
// Se persiste en `operational_model.state_rules`, que ya viajaba en el `.pulso`
// sin que nadie lo usara desde la UI: `outcome_values` son los crudos asignados
// y `final_state` la familia. El `color` se añadió a la whitelist de R.

import { AlertTriangle, CheckCircle2, Loader2, Save } from "../../../vendor/lucide-react";
import type { MonitoreoConfig, MonitoreoState } from "../../../api/client";
import { contar } from "../fuentes/vocabulario";
import { ACREDITACION_ORDEN_FAMILIAS, acreditacionEtiquetaDeFamilia } from "./familiasDeLlamada";
import type { AcreditacionFamiliaLlamada } from "./familiasDeLlamada";
import { useDeclaracionDeEstados, type EntradaDeEstado } from "./useDeclaracionDeEstados";
import "./definidorDeEstados.css";

export function DefinidorDeEstados({
  entradas,
  config,
  onStateChange,
}: {
  entradas: EntradaDeEstado[];
  config?: MonitoreoConfig | null;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  // El borrador y el guardado viven en el hook, que comparte Insumos › Estados.
  const declaracion = useDeclaracionDeEstados({ entradas, config, onStateChange });
  const { detectados, sinConfirmar, sucio, guardando, error } = declaracion;
  const guardar = declaracion.guardar;

  if (!entradas.length) {
    return (
      <p className="tel-estados-vacio">
        El corte todavía no trae estados de la base de barrido. Sincroniza la hoja para confirmarlos.
      </p>
    );
  }

  return (
    <div className="tel-estados">
      <header className="tel-estados-cabecera">
        <div>
          <span>Estados de la base</span>
          <strong>
            {sinConfirmar
              ? `${sinConfirmar} de ${detectados.length} sin confirmar`
              : `${detectados.length} confirmados`}
          </strong>
          <em>
            {/* R4: se nombra la consecuencia, no el concepto. */}
            Los estados los escribe el cliente y cambian entre estudios. Lo que confirmes aquí manda sobre la
            detección automática, también en los cortes siguientes.
          </em>
        </div>
        <button
          type="button"
          className="pulso-button is-primary"
          disabled={!sucio || guardando || !declaracion.puedeGuardar}
          onClick={() => { void guardar(); }}
        >
          {guardando ? <Loader2 size={14} className="pulso-spin" /> : <Save size={14} />}
          <span>{guardando ? "Guardando…" : "Confirmar estados"}</span>
        </button>
      </header>

      {error ? <p className="tel-estados-error"><AlertTriangle size={14} /> {error}</p> : null}

      <section className="tel-estados-colores" aria-label="Color de cada familia">
        {ACREDITACION_ORDEN_FAMILIAS.map((familia) => {
          const color = declaracion.colorDe(familia);
          return (
            <label key={familia} className="tel-estados-color">
              <input
                type="color"
                value={color}
                onChange={(event) => {
                  // El valor se lee ANTES del updater. `currentTarget` es null
                  // dentro de la función de actualización —React ya recicló el
                  // evento sintético para entonces— y leerlo ahí revienta la
                  // vista entera con «Cannot read properties of null».
                  const elegido = event.currentTarget.value;
                  declaracion.colorear(familia, elegido);
                }}
                aria-label={`Color de ${acreditacionEtiquetaDeFamilia(familia)}`}
              />
              <span>{acreditacionEtiquetaDeFamilia(familia)}</span>
            </label>
          );
        })}
      </section>

      <section
        className="tel-estados-lista"
        aria-label="Estados detectados en la base de barrido"
        data-qa-geometry-group="telefono-estados-detectados"
        data-qa-geometry-contract="equal"
        data-qa-geometry-capacity="owned"
      >
        {detectados.map((estado) => (
          <article key={estado.crudo} className="tel-estados-fila" data-qa-geometry-member>
            <div className="tel-estados-crudo">
              {/* El crudo se muestra tal cual lo escribió el cliente, erratas
                * incluidas: es la llave con la que se cruza el dato. */}
              <strong>{estado.crudo}</strong>
              <em>{contar(estado.value, "caso", "casos")}</em>
            </div>
            <span className={`tel-estados-marca${estado.confirmado ? " is-confirmado" : ""}`}>
              {estado.confirmado
                ? <><CheckCircle2 size={12} /> Confirmado</>
                : <>Detectado</>}
            </span>
            <select
              value={declaracion.familiaDe(estado.crudo, estado.familia)}
              onChange={(event) => {
                // Mismo motivo que en el selector de color: fuera del updater.
                const elegida = event.currentTarget.value as AcreditacionFamiliaLlamada;
                declaracion.asignar(estado.crudo, elegida);
              }}
              aria-label={`Familia de ${estado.crudo}`}
              style={{ borderLeftColor: declaracion.colorDe(estado.familia) }}
            >
              {ACREDITACION_ORDEN_FAMILIAS.map((familia) => (
                <option key={familia} value={familia}>{acreditacionEtiquetaDeFamilia(familia)}</option>
              ))}
            </select>
          </article>
        ))}
      </section>
    </div>
  );
}
