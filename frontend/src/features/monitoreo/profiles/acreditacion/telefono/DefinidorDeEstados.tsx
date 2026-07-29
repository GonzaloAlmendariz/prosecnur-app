// Definidor de estados telefónicos — C2 del plan.
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

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Save } from "../../../../../vendor/lucide-react";
import type { MonitoreoConfig, MonitoreoState, MonitoreoStateRule } from "../../../../../api/client";
import { apiMonitoreoConfig } from "../../../../../api/client";
import { contar } from "../../../fuentes/vocabulario";
import {
  ACREDITACION_ORDEN_FAMILIAS,
  acreditacionColorDeFamilia,
  acreditacionDeclaracionesDesdeReglas,
  acreditacionEstadosDetectados,
  acreditacionEtiquetaDeFamilia,
} from "../AcreditacionEstadosLlamada";
import type { AcreditacionFamiliaLlamada } from "../AcreditacionEstadosLlamada";
import "./telefono.css";

type Entrada = { label: string; value: number };

/** Las reglas de estado que NO son de familia se conservan intactas: pertenecen
 * al modelo operativo telefónico y esta pantalla no las gobierna. */
function reglasAjenas(reglas: readonly MonitoreoStateRule[]) {
  const familias = new Set<string>(ACREDITACION_ORDEN_FAMILIAS);
  return reglas.filter((regla) => !familias.has(regla.final_state));
}

export function DefinidorDeEstados({
  entradas,
  config,
  onStateChange,
}: {
  entradas: Entrada[];
  config?: MonitoreoConfig | null;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const reglas = config?.operational_model.state_rules ?? [];
  const guardadas = useMemo(() => acreditacionDeclaracionesDesdeReglas(reglas), [reglas]);

  // Borrador local: confirmar veinte estados de uno en uno contra la red sería
  // insoportable, así que se edita en memoria y se guarda una vez.
  const [asignaciones, setAsignaciones] = useState<Record<string, AcreditacionFamiliaLlamada>>({});
  const [colores, setColores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const declaraciones = useMemo(() => {
    const base = guardadas.map((item) => ({ ...item, color: colores[item.familia] ?? item.color }));
    const porFamilia = new Map(base.map((item) => [item.familia, { ...item, crudos: [...item.crudos] }]));
    for (const [crudo, familia] of Object.entries(asignaciones)) {
      const actual = porFamilia.get(familia)
        ?? { familia, color: colores[familia] ?? "", crudos: [] as string[] };
      actual.crudos = [...actual.crudos.filter((item) => item !== crudo), crudo];
      porFamilia.set(familia, actual);
      // Un crudo pertenece a una sola familia: se retira de las demás.
      for (const [otra, decl] of porFamilia) {
        if (otra !== familia) decl.crudos = decl.crudos.filter((item) => item !== crudo);
      }
    }
    for (const [familia, color] of Object.entries(colores)) {
      const clave = familia as AcreditacionFamiliaLlamada;
      const actual = porFamilia.get(clave) ?? { familia: clave, color: "", crudos: [] as string[] };
      porFamilia.set(clave, { ...actual, color });
    }
    return [...porFamilia.values()];
  }, [asignaciones, colores, guardadas]);

  const detectados = useMemo(
    () => acreditacionEstadosDetectados(entradas, declaraciones),
    [declaraciones, entradas],
  );
  const sinConfirmar = detectados.filter((item) => !item.confirmado).length;
  const sucio = Object.keys(asignaciones).length > 0 || Object.keys(colores).length > 0;

  async function guardar() {
    if (!config) return;
    setGuardando(true);
    setError("");
    try {
      const propias: MonitoreoStateRule[] = declaraciones
        .filter((item) => item.crudos.length || item.color)
        .map((item, index) => ({
          id: `estado-${item.familia}`,
          label: acreditacionEtiquetaDeFamilia(item.familia),
          final_state: item.familia,
          priority: 100 + index,
          outcome_values: item.crudos,
          stop_contact: false,
          color: item.color || acreditacionColorDeFamilia(item.familia, []),
        } as MonitoreoStateRule));
      const result = await apiMonitoreoConfig({
        ...config,
        operational_model: {
          ...config.operational_model,
          state_rules: [...reglasAjenas(reglas), ...propias],
        },
      });
      onStateChange?.(result.state);
      setAsignaciones({});
      setColores({});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

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
          disabled={!sucio || guardando || !config}
          onClick={() => { void guardar(); }}
        >
          {guardando ? <Loader2 size={14} className="pulso-spin" /> : <Save size={14} />}
          <span>{guardando ? "Guardando…" : "Confirmar estados"}</span>
        </button>
      </header>

      {error ? <p className="tel-estados-error"><AlertTriangle size={14} /> {error}</p> : null}

      <section className="tel-estados-colores" aria-label="Color de cada familia">
        {ACREDITACION_ORDEN_FAMILIAS.map((familia) => {
          const color = colores[familia] ?? acreditacionColorDeFamilia(familia, guardadas);
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
                  setColores((actual) => ({ ...actual, [familia]: elegido }));
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
              value={asignaciones[estado.crudo] ?? estado.familia}
              onChange={(event) => {
                // Mismo motivo que en el selector de color: fuera del updater.
                const elegida = event.currentTarget.value as AcreditacionFamiliaLlamada;
                setAsignaciones((actual) => ({ ...actual, [estado.crudo]: elegida }));
              }}
              aria-label={`Familia de ${estado.crudo}`}
              style={{ borderLeftColor: colores[estado.familia] ?? acreditacionColorDeFamilia(estado.familia, guardadas) }}
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
