import type { HojasRutaAlert } from "../../../api/hojasRuta";
import { avisosVisibles, textoDeAviso } from "./filtroDeAvisos";

/** Los avisos del motor de R en un inspector del lienzo (P5); nada si no hay ninguno que pintar. */
export function AvisosDelMotor({ avisos, extra = [] }: { avisos: readonly HojasRutaAlert[] | null | undefined; extra?: readonly string[] }) {
  const visibles = avisosVisibles(avisos);
  if (!visibles.length && !extra.length) return null;
  return (
    <>
      {extra.map((t) => (
        <p key={t} className="hr-mapa-aviso">{t}</p>
      ))}
      {visibles.map((a) => (
        <p key={`${a.code}|${a.message}`} className="hr-mapa-aviso" data-codigo={a.code}>{textoDeAviso(a)}</p>
      ))}
    </>
  );
}
