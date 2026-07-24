import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const featureDir = path.dirname(fileURLToPath(import.meta.url));

describe("Home module picker deep-link", () => {
  it("materializes the picker from agregar=1 even when the project has no modules", () => {
    const page = fs.readFileSync(path.join(featureDir, "HomePage.tsx"), "utf8");

    expect(page).toMatch(
      /const \[pickerOpen,\s*setPickerOpen\] = useState\(false\)/,
    );
    expect(page).toMatch(
      /if\s*\(params\.get\("agregar"\)\s*===\s*"1"\)\s*setPickerOpen\(true\)/,
    );
    expect(page).toMatch(/\{pickerOpen\s*&&\s*createPortal\(/);
    expect(page).not.toMatch(/\{pickerOpen\s*&&\s*hasModules\s*&&\s*createPortal\(/);
  });

  it("closes by deleting only agregar and replacing the current Home entry", () => {
    const page = fs.readFileSync(path.join(featureDir, "HomePage.tsx"), "utf8");

    expect(page).toMatch(/const params = new URLSearchParams\(location\.search\)/);
    expect(page).toContain('params.delete("agregar")');
    expect(page).toMatch(
      /navigate\(\{ pathname: "\/", search: params\.toString\(\) \? `\?\$\{params\.toString\(\)\}` : "" \}, \{ replace: true \}\)/,
    );
  });
});
