import type { CalcMuestraComponente } from "../../../api/calcMuestra";
import type { CalcMuestraGeneralCorrida, CalcMuestraGeneralMarco } from "../../../api/calcMuestraGeneral";
import { BandaDiseno } from "./BandaDiseno";
import { cadenaDisenoGeneral, cifrasDisenoGeneral } from "./bandaDisenoModelo";

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
  return (
    <BandaDiseno
      grupo="calc-muestra/general-diseno-vigente"
      cadena={cadenaDisenoGeneral({ comp, marco, corrida })}
      cifras={cifrasDisenoGeneral({ comp, marco, corrida, seccion })}
    />
  );
}
