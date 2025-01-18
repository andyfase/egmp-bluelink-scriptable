type IconColor =
  | "blue"
  | "red"
  | "gray"
  | "deep-gray"
  | "yellow"
  | "light-gray"
  | "cyan"
  | "deep-green"
  | "green"
  | "deep-blue"
  | "purple"
  | "pink";

export type ScriptSettings = {
  iconColor: IconColor;
  iconGlyph: string;
  alwaysRunInApp?: true;
};

type SettingsGroup = Record<string, ScriptSettings>;

export const SETTINGS: SettingsGroup = {
  helloWorld: { iconColor: "blue", iconGlyph: "eye" },
  storybook: { iconColor: "pink", iconGlyph: "palette" },
  test: { iconColor: "deep-blue", iconGlyph: "gear" },
};