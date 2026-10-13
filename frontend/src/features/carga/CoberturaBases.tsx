// Cobertura de un tema en las bases (U2).
//
// «3 de 7»: la misma forma con dos bases que con veinte. Los puntos por base
// que había antes dejaban de distinguirse con muchas bases. El `title` y el
// texto accesible nombran las bases donde está y donde falta.

import { coberturaDeBases } from "./equivalenciasAnchos";

export function CoberturaBases({
  bases,
  variables,
}: {
  bases: readonly string[];
  variables: Record<string, string | undefined>;
}) {
  const cob = coberturaDeBases(bases, variables);
  return (
    <span
      className={cob.faltantes.length ? "pulso-equiv-cobertura is-parcial" : "pulso-equiv-cobertura"}
      title={cob.detalle}
    >
      <span aria-hidden="true">{cob.texto}</span>
      <span className="pulso-sr-only">
        {cob.texto} bases. {cob.detalle}
      </span>
    </span>
  );
}
