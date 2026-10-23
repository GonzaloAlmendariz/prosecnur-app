import { Alert } from "../../../../../../components/Alert";
import { Switch } from "../../../../../../components/Switch";
import { fmt } from "../../formato";

/**
 * Tarjeta «Llave de cruce» de Insumos › Reglas: con qué columnas del padrón y
 * de la respuesta se reconoce a una persona, en orden de prueba, y cómo cruzó
 * quien respondió en el último corte.
 */
export function LlaveDeCruce({
  padron,
  respuesta,
  automatica,
  respaldoNombre,
  cruces,
  onAutomatica,
  onRespaldoNombre,
  bloqueada,
}: {
  padron: readonly string[];
  respuesta: readonly string[];
  automatica: boolean;
  respaldoNombre: boolean;
  cruces: ReadonlyArray<{ rotulo: string; casos: number }> | null;
  onAutomatica: (valor: boolean) => void;
  onRespaldoNombre: (valor: boolean) => void;
  bloqueada: boolean;
}) {
  const total = (cruces ?? []).reduce((suma, item) => suma + item.casos, 0);
  return (
    <section className="acr-av-panel acr-rg-tarjeta" aria-label="Llave de cruce" data-qa-geometry-member>
      <header className="acr-av-panel-cabecera"><h3>Llave de cruce</h3></header>
      <div className="acr-rg-cuerpo">
        <div className="acr-rg-columnas">
          <div>
            <span className="acr-av-antetitulo">Columnas del padrón</span>
            <ol className="acr-in-llave">
              {padron.map((columna, indice) => <li key={columna}><span className="acr-av-tenue acr-av-num">{fmt(indice + 1)}</span><span className="acr-in-columna">{columna}</span></li>)}
            </ol>
          </div>
          <div>
            <span className="acr-av-antetitulo">Campos de la respuesta</span>
            <ol className="acr-in-llave">
              {respuesta.map((columna, indice) => <li key={columna}><span className="acr-av-tenue acr-av-num">{fmt(indice + 1)}</span><span className="acr-in-columna">{columna}</span></li>)}
            </ol>
          </div>
        </div>
        <div className="acr-rg-switch">
          <Switch checked={automatica} onToggle={() => onAutomatica(!automatica)} ariaLabel="Detectar la llave automáticamente" disabled={bloqueada} />
          <span>Detectar la llave automáticamente</span>
        </div>
        <div className="acr-rg-switch">
          <Switch checked={respaldoNombre} onToggle={() => onRespaldoNombre(!respaldoNombre)} ariaLabel="Usar el nombre como respaldo" disabled={bloqueada} />
          <span>Usar el nombre como respaldo</span>
        </div>
        <div>
          <span className="acr-av-antetitulo">Cómo cruzó en el último corte</span>
          {cruces?.length ? (
            <ul className="acr-rg-cruces">
              {cruces.map((item) => (
                <li key={item.rotulo}>
                  <span>{item.rotulo}</span>
                  <span className="acr-av-pista"><i style={{ width: `${total ? (item.casos / total) * 100 : 0}%` }} /></span>
                  <b className="acr-av-num">{fmt(item.casos)}</b>
                </li>
              ))}
            </ul>
          ) : <Alert kind="info">El cruce del último corte llega con la sección Control.</Alert>}
        </div>
      </div>
    </section>
  );
}
