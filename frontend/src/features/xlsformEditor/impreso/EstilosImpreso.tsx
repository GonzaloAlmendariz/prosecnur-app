// «Estilos» de Impreso › Formato (L36 · D-L36-21): la tipografía y los colores con que se imprime el cuestionario,
// con candado. Vienen del estándar de Pulso (`estandar_pulso.json` › `cuestionario`, el mismo que lee el motor) y no
// se cambian por documento: así todos los estudios salen iguales y se fotocopian bien. Mismo candado que las láminas
// estándar de F6.

import { Lock } from "../../../vendor/lucide-react";
import { ESTANDAR_CUESTIONARIO, type EstandarCuestionario } from "./estandarCuestionario.generated";
import { TarjetaImpreso } from "./TarjetaImpreso";

const NOMBRES_COLOR: Record<keyof EstandarCuestionario["colores"], string> = {
  tinta: "Tinta",
  rejilla: "Rejilla",
  banda: "Banda de sección",
  banda_sub: "Banda de subsección",
  cebra: "Filas alternas",
};

export function filasTipografia(e: EstandarCuestionario): Array<[string, string]> {
  const { fuente, cuerpo, minimo, titulo, unidad } = e.tipografia;
  return [
    ["Fuente", fuente],
    ["Título", `${titulo} ${unidad}`],
    ["Cuerpo de texto", `${cuerpo} ${unidad}`],
    ["Rótulos y notas", `${minimo} ${unidad}`],
  ];
}

export function EstilosImpreso({ estandar = ESTANDAR_CUESTIONARIO }: { estandar?: EstandarCuestionario }) {
  return (
    <TarjetaImpreso id="imp-estilos" titulo="Estilos" ayuda="Tipografía y colores del papel.">
      <p className="pulso-xf-imp-candado" role="note">
        <Lock size={14} aria-hidden="true" />
        Vienen del estándar de Pulso: todos los cuestionarios se imprimen así, en negro y grises que se fotocopian bien.
      </p>
      <dl className="pulso-xf-imp-estilos-lista">
        {filasTipografia(estandar).map(([rotulo, valor]) => (
          <div key={rotulo} className="pulso-xf-imp-estilos-fila">
            <dt>{rotulo}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
        {(Object.keys(NOMBRES_COLOR) as Array<keyof EstandarCuestionario["colores"]>).map((clave) => (
          <div key={clave} className="pulso-xf-imp-estilos-fila">
            <dt>{NOMBRES_COLOR[clave]}</dt>
            <dd>
              {/* El color es un dato del estándar, no un estilo de la app: por eso va en línea. */}
              <span className="pulso-xf-imp-estilos-muestra" style={{ background: estandar.colores[clave] }} aria-hidden="true" />
              {estandar.colores[clave]}
            </dd>
          </div>
        ))}
      </dl>
    </TarjetaImpreso>
  );
}
