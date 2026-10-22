// Lo que impide exportar, dicho con su salida (#13 del QA e10): en lugar de
// «están en la pestaña Revisión», un enlace que cierra Exportar y abre la
// Revisión.

import { ChevronRight } from "../../../vendor/lucide-react";

export function VerLosPuntos({ errores, onVer }: { errores: number; onVer?: () => void }) {
  const uno = errores === 1;
  return (
    <>
      La revisión tiene {errores} {uno ? "punto" : "puntos"} por corregir.
      {onVer ? (
        <>
          {" "}
          <button type="button" className="rec-mail-link rec-exp-ver-puntos" onClick={onVer}>
            {uno ? "Ver el punto" : `Ver los ${errores} puntos`} <ChevronRight size={12} aria-hidden />
          </button>
        </>
      ) : null}
    </>
  );
}
