// P5b de la pasada de formato: la carga de un BLOQUE dentro de una vista que ya
// se declaró lista. Sin marca propia, la vista publicaba su readiness con el
// bloque aún en «Leyendo…» y la captura medía una pantalla a medio cargar
// (Territorial › Códigos y › Entrega, Aulas › Entrega › Plantillas). La marca
// `false` sólo dice «todavía no» (readinessAnidada): quien la monta la quita al
// recibir el dato O el error, así que nunca es un false terminal.

import { LoadingBlock } from "../../components/States";

export function CargaDeBloque({ label }: { label: string }) {
  return (
    <div data-audit-ready="false">
      <LoadingBlock label={label} variant="inline" />
    </div>
  );
}
