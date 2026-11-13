/**
 * Las filas de "Valor distinto al habitual en su grupo" en la caja
 * "Condiciones" del panel de regla: la variable que forma el grupo, la
 * variable a revisar y los dos umbrales (porcentaje del valor más común y casos
 * por grupo) con los valores por defecto del motor ya escritos. Lo que se
 * guarda lo arma `paramsDeModa`; el motor es `api/R/reglas_custom_moda_grupo.R`.
 * Los grupos sin referencia y los casos marcados los muestra "Casos que marca
 * hoy" con la lectura del motor.
 */
import { PulsoInput } from "../../../../components/PulsoInput";
import type { ExploradorVariable } from "../../types";
import type { AccionDeBorrador, Borrador } from "../borradorDeRegla";
import { CampoPregunta } from "../campos/CampoPregunta";
import { APOYO_MIN_POR_DEFECTO, N_MIN_POR_DEFECTO, preguntasDeModa } from "../modeloModa";
import { Fila } from "./FilaDeRegla";
import "./camposDeModa.css";

function texto(valor: unknown): string {
  return typeof valor === "number" || typeof valor === "string" ? String(valor) : "";
}

export function CamposDeModa({
  borrador: b,
  despachar,
  variables,
}: {
  borrador: Borrador;
  despachar: (accion: AccionDeBorrador) => void;
  variables: readonly ExploradorVariable[];
}) {
  const { valor, grupo } = preguntasDeModa(b.params);
  const setParam = (clave: string, v: unknown) => despachar({ tipo: "param", clave, valor: v });
  return (
    <>
      <Fila variante="campo" rotulo="Variable que forma el grupo">
        <CampoPregunta
          variables={variables}
          valor={grupo}
          onCambio={(v) => setParam("grupo", v)}
          ariaLabel="Variable que forma el grupo"
          placeholder="Por ejemplo, el distrito"
        />
      </Fila>
      <Fila variante="campo" rotulo="Variable a revisar">
        <CampoPregunta
          variables={variables}
          valor={valor}
          onCambio={(v) => setParam("valor", v)}
          ariaLabel="Variable a revisar"
          placeholder="Por ejemplo, el ubigeo"
        />
      </Fila>
      <Fila variante="campo" rotulo="El valor más común debe reunir al menos">
        <span className="pulso-regla-moda-umbral">
          <PulsoInput
            type="number"
            min={1}
            max={100}
            step={1}
            value={texto(b.params.apoyo_min ?? APOYO_MIN_POR_DEFECTO)}
            onChange={(e) => setParam("apoyo_min", e.target.value)}
            aria-label="Porcentaje mínimo del grupo que debe reunir el valor más común"
          />
          <span>% del grupo</span>
        </span>
      </Fila>
      <Fila variante="campo" rotulo="Solo grupos de al menos">
        <span className="pulso-regla-moda-umbral">
          <PulsoInput
            type="number"
            min={2}
            step={1}
            value={texto(b.params.n_min ?? N_MIN_POR_DEFECTO)}
            onChange={(e) => setParam("n_min", e.target.value)}
            aria-label="Mínimo de casos que debe tener el grupo"
          />
          <span>casos</span>
        </span>
      </Fila>
    </>
  );
}
