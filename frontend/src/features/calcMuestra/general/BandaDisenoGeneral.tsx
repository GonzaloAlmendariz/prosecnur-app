import type { CalcMuestraComponente } from "../../../api/calcMuestra";
import type { CalcMuestraGeneralCorrida, CalcMuestraGeneralMarco } from "../../../api/calcMuestraGeneral";
import { BandaDiseno } from "./BandaDiseno";
import { avisoMargenGeneral, cadenaDisenoGeneral, cifrasDisenoGeneral } from "./bandaDisenoModelo";

/** Muestra general: N, estratos, n completas, n a campo, margen y técnica; en Selección, la corrida. */
export function BandaDisenoGeneral({
  comp,
  marco,
  corrida,
  seccion,
}: {
  comp: CalcMuestraComponente | null;
  marco: CalcMuestraGeneralMarco | null;
  corrida: CalcMuestraGeneralCorrida | null;
  seccion: string;
}) {
  // Resultados ya da su veredicto; en las demás secciones el porqué va bajo
  // las cifras, junto a la tarjeta que lo marca en alerta (L4).
  const aviso = seccion === "resultados" ? null : avisoMargenGeneral(comp);
  return (
    <BandaDiseno
      grupo="calc-muestra/general-diseno-vigente"
      cadena={cadenaDisenoGeneral({ comp, marco, corrida })}
      cifras={cifrasDisenoGeneral({ comp, marco, corrida, seccion })}
    >
      {aviso && (
        <p className="cmg-banda-aviso" role="status" data-qa-geometry-member>
          {aviso}
        </p>
      )}
    </BandaDiseno>
  );
}
