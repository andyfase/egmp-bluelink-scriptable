import { Plugin } from "rollup";
import { ScriptSettings, SETTINGS } from "./scriptIconSettings";

const COMMENT_ATOMS = {
  line1: "Variables used by Scriptable.",
  line2: "These must be at the very top of the file. Do not edit.",
  runInApp: "always-run-in-app: true;",
};

const getScriptableSettingsCommentLines = ({
  iconColor,
  iconGlyph,
  alwaysRunInApp,
}: ScriptSettings) => {
  const colorAtom = `icon-color: ${iconColor};`;
  const iconAtom = `icon-glyph: ${iconGlyph};`;
  const line3 = alwaysRunInApp
    ? [COMMENT_ATOMS.runInApp, colorAtom]
    : [colorAtom, iconAtom];
  const line4 = alwaysRunInApp ? iconAtom : null;
  return [COMMENT_ATOMS.line1, COMMENT_ATOMS.line2, line3.join(" "), line4]
    .filter(Boolean)
    .map(text => `// ${text}`)
    .join("\n");
};

const fallbackIconSettings: ScriptSettings = {
  alwaysRunInApp: true,
  iconColor: "yellow",
  iconGlyph: "exclamation-triangle",
};

const getBannerForFilePath = (filePath: string) => {
  const matchForTsFiles = filePath.match(/.*\/([a-z0-9\.]+)\.ts/i);
  if (!matchForTsFiles?.[1]) return null;
  const filename = matchForTsFiles[1];

  const settingsForFile = SETTINGS[filename];
  if (settingsForFile) {
    return getScriptableSettingsCommentLines(settingsForFile);
  }
  const DIVIDER = "-".repeat(50);
  // eslint-disable-next-line no-console
  console.log(
    ["", DIVIDER, `Missing settings for ${filename}!`, DIVIDER, ""].join("\n")
  );
  return getScriptableSettingsCommentLines(fallbackIconSettings);
};

//

const addFileIconSettings = (filePath: string): Plugin => ({
  name: "rollup-plugin-scriptable-icon-settings",
  renderChunk: code => {
    const commentLines = getBannerForFilePath(filePath);
    return commentLines ? [commentLines, code].join("\n") : code;
  },
});

export default addFileIconSettings;