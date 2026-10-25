import { Alert } from "../../../../../components/Alert";
import { CabeceraDeTarjeta } from "../navegacion/rotuloDePestana";

/**
 * Modelo › Metas sin filas que mostrar. El marco no cambia (C2/C3): la tarjeta
 * «Meta del estudio» lleva el aviso dentro y, mientras el estado de cuotas
 * llega o el motor prepara el cruce, la rejilla muestra el esqueleto de las
 * tarjetas por público en vez de un lienzo vacío.
 */
export function MetasEnEspera({ motivo, error }: { motivo: "leyendo" | "preparando" | "sin-publicos"; error?: string }) {
  const esperando = !error && motivo !== "sin-publicos";
  const texto = error
    || (motivo === "leyendo"
      ? "Leyendo los públicos del estudio."
      : motivo === "preparando"
        ? "El motor está preparando el cruce del padrón; las metas aparecen al terminar."
        : "El estudio todavía no tiene públicos con padrón. Se declaran en Insumos › Públicos.");
  return (
    <div className="acr-mo-metas" data-vacio={motivo} aria-busy={esperando || undefined}>
      <section className="acr-av-panel" aria-label="Meta del estudio">
        <CabeceraDeTarjeta primera><h3>Meta del estudio</h3></CabeceraDeTarjeta>
        <div className="acr-ct-cuerpo"><Alert kind={error ? "error" : "info"}>{texto}</Alert></div>
      </section>
      {esperando ? (
        <div className="acr-mo-tarjetas is-esqueleto" aria-hidden="true">
          {[0, 1, 2, 3].map((indice) => (
            <div key={indice} className="acr-mo-tarjeta is-esqueleto">
              <span className="acr-mo-hueso is-corto" />
              <span className="acr-mo-hueso is-titulo" />
              <div className="acr-mo-teselas">
                {[0, 1, 2, 3].map((tesela) => <span key={tesela} className="acr-mo-tesela acr-mo-hueso is-tesela" />)}
              </div>
              <span className="acr-mo-hueso is-pista" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
