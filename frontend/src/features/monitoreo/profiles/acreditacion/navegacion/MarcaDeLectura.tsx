/**
 * Marca de readiness de las pestañas que leen el estado de cuotas del motor
 * (`GET /api/monitoreo/cuotas`): Modelo › Metas, Modelo › Cuotas e Insumos ›
 * Públicos. Publica `false` sólo mientras esa lectura no llega o el motor
 * todavía prepara el cruce del padrón (los dos se vuelven a pedir solos); con
 * el estado leído, o con su error, publica `true`. Así una captura no sale con
 * «Leyendo…» ni necesita un `--post-click-wait-selector`.
 */
export function MarcaDeLectura({ leyendo }: { leyendo: boolean }) {
  return <span hidden data-audit-ready={leyendo ? "false" : "true"} />;
}
