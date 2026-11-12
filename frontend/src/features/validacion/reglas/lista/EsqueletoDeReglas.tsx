/**
 * Las tres columnas de Reglas mientras se lee el catálogo (prototipo, molde de
 * carga `vistas.js:1186`): cada contenedor con su silueta, para que al llegar
 * los datos nada salte. La readiness la retiene la carga de bloque del kit en la
 * columna central; las siluetas no escriben marca (contrato de `Skeleton`).
 *
 * `FichaVacia` es la tercera columna cuando la familia no tiene nada que elegir:
 * el contenedor se queda en su lugar con su vacío dentro (C3).
 */
import { Layers, ListChecks } from "../../../../vendor/lucide-react";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { PanelDeMesa } from "../../../../components/procesamiento/PanelDeMesa";
import { CargaDeBloque } from "../../../../components/CargaDeBloque";
import { Skeleton } from "../../../../components/Skeleton";

function Filas({ n }: { n: number }) {
  return (
    <div className="pulso-rl-esqueleto">
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} forma="fila" />
      ))}
    </div>
  );
}

export function EsqueletoDeReglas() {
  return (
    <>
      <PanelDeMesa zona="familias" titulo="Familias" icono={<Layers size={15} />} ocupado>
        <Filas n={8} />
      </PanelDeMesa>
      <PanelDeMesa zona="reglas" titulo="Reglas" ocupado>
        {/* La marca de "todavía no" de la pestaña: se va con el catálogo o con su error. */}
        <CargaDeBloque label="Leyendo el catálogo de reglas" />
        <Filas n={5} />
      </PanelDeMesa>
      <PanelDeMesa zona="ficha" titulo="Ficha de la regla" ocupado>
        <Filas n={4} />
      </PanelDeMesa>
    </>
  );
}

export function FichaVacia() {
  return (
    <PanelDeMesa zona="ficha" titulo="Ficha de la regla">
      <EstadoVacio
        icono={<ListChecks size={20} />}
        titulo="Sin regla elegida"
      />
    </PanelDeMesa>
  );
}
