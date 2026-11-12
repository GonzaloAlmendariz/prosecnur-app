import type { EstudioBase } from "../../../../api/client";
import type { CifraDePestana } from "../../../../components/procesamiento/CifrasDePestana";
import { formatoConteo } from "../../../../lib/formatoNumero";
import type { ContextoDeCarga } from "../contextoDeCarga";
import { BASE_UNICA } from "../contextoDeCarga";
import { CargaBaseSheetPane } from "../HojaBaseCarga";
import { CabeceraDeMesaDeCarga } from "../revision/CabeceraDeMesaDeCarga";
import { etiquetaDeBase } from "../bases/basesModel";
import { SelectorDeBaseCarga } from "../SelectorDeBaseCarga";
import "../revision/marcoDeMesa.css";
import "../../../../components/procesamiento/mesa-procesamiento.css";
import "./respuestas.css";

/** Cuántas fuentes juntó la base: las encuestas de SurveyMonkey, los orígenes integrados o su archivo. */
export function fuentesDeLaBase(base: EstudioBase | null | undefined): number | null {
  if (!base) return null;
  const sm = base.surveymonkey_sources?.length ?? 0;
  if (sm > 0) return sm;
  const integradas = base.multi_integrated?.origins?.length ?? 0;
  if (integradas > 0) return integradas;
  return base.data_file_id ? 1 : null;
}

/**
 * Carga › Respuestas con la forma del prototipo "carga-respuestas": la
 * cabecera con las fuentes, la versión de la base y, con varias bases, el
 * selector; debajo, la hoja de la base a todo el ancho y hasta el pie.
 *
 * Las filas y las columnas no van en la cabecera: la hoja ya las dice dos
 * veces (arriba y en el pie) y una cifra va una sola vez. El conmutador
 * Cargada, Limpia y Codificada es un hueco declarado: la hoja de Carga solo
 * lee la base cargada (`/api/carga/base-sheet`).
 */
export function MesaDeRespuestas({ contexto }: { contexto: ContextoDeCarga }) {
  const { esVarias, basesTodas, baseElegida, onCambiarBase, ocupado, error, todoListo, estudio } = contexto;
  const base = esVarias
    ? basesTodas.find((b) => b.nombre === baseElegida) ?? basesTodas[0] ?? null
    : estudio?.bases?.[BASE_UNICA] ?? null;
  const fuentes = fuentesDeLaBase(base);
  const conRespuestas = esVarias ? Boolean(base?.data_file_id) : todoListo;
  const cifras: CifraDePestana[] = [];
  if (conRespuestas && fuentes !== null) {
    cifras.push({ clave: "fuentes", valor: formatoConteo(fuentes), rotulo: fuentes === 1 ? "fuente" : "fuentes" });
  }
  if (conRespuestas) {
    cifras.push({ clave: "version", valor: "Cargada", rotulo: "versión de la base", rango: 1 });
  }
  const nombres = basesTodas.map((b) => b.nombre);
  return (
    <div className="pulso-carga-mesa-kit pulso-respuestas" data-carga-surface="data">
      <div className="pulso-mesa-pestana-superficie">
        <div className="pulso-mesa-pestana-marco">
          <CabeceraDeMesaDeCarga
            pestana="respuestas"
            titulo="Respuestas"
            cifras={cifras}
            pendientes='Conmutador "Cargada, Limpia, Codificada": la hoja de Carga solo lee la base cargada. Filas y columnas: las dice la hoja'
            acciones={esVarias && nombres.length > 1 ? (
              <SelectorDeBaseCarga bases={nombres} etiquetas={Object.fromEntries(basesTodas.map((b) => [b.nombre, etiquetaDeBase(b)]))} elegida={base?.nombre ?? ""} onCambiar={onCambiarBase} deshabilitado={Boolean(ocupado)} />
            ) : undefined}
          />
          <div className="pulso-respuestas-hoja" data-qa-geometry-capacity="owned">
            <CargaBaseSheetPane
              isMultiBase={esVarias}
              allReady={todoListo}
              busy={ocupado}
              error={error}
              baseOptions={esVarias ? basesTodas : []}
              selectedBase={esVarias ? baseElegida : ""}
              onSelectedBaseChange={onCambiarBase}
              selectorFuera
            />
          </div>
        </div>
      </div>
    </div>
  );
}
