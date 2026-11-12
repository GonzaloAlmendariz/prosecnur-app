// Los tres pasos de "Actualizar" (prototipo `.pp-pasos`). Solo indican dónde se
// está: no se navega entre ellos, por eso es una lista y no un stepper con botones.

import { Check } from "../../../vendor/lucide-react";

export type PasoDeActualizacion = "elegir" | "que-cambia" | "hecho";

const PASOS = [
  { id: "elegir", rotulo: "Elegir el archivo" },
  { id: "que-cambia", rotulo: "Qué cambia" },
  { id: "aplicar", rotulo: "Aplicar" },
] as const;

export function estadoDelPaso(indice: number, paso: PasoDeActualizacion): "hecho" | "actual" | "pendiente" {
  const actual = paso === "elegir" ? 0 : paso === "que-cambia" ? 1 : 3;
  return indice < actual ? "hecho" : indice === actual ? "actual" : "pendiente";
}

export function PasosDeActualizacion({ paso }: { paso: PasoDeActualizacion }) {
  return (
    <ol className="pulso-actualizar-pasos" aria-label="Pasos de la actualización">
      {PASOS.map((p, i) => {
        const e = estadoDelPaso(i, paso);
        return (
          <li key={p.id} data-e={e} aria-current={e === "actual" ? "step" : undefined}>
            <i aria-hidden="true">{e === "hecho" ? <Check size={12} /> : i + 1}</i>
            {p.rotulo}
          </li>
        );
      })}
    </ol>
  );
}
