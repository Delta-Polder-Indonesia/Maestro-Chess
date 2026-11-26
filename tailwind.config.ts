import type { Config } from "tailwindcss";

export const maxVertical = 1100
export const reduceSummary = 1669
export const navTop = 516

// ChessClub uses Tailwind v4's quarter-rem spacing scale and variable colors
// with opacity modifiers. Keep the port compatible with Maestro's Tailwind v3.
const spacing = Object.fromEntries(Array.from({ length: 241 }, (_, i) => [String(i / 2), `${i / 8}rem`]));
const variableColor = (name: string) =>
  `color-mix(in srgb, var(--${name}) calc(<alpha-value> * 100%), transparent)`;

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/halaman/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/errors/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      spacing,
      fontFamily: { sans: ["Geist Variable", "Arial", "sans-serif"] },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",

        foregroundHighlighted: "var(--foregroundHighlighted)",
        foregroundGrey: variableColor("foregroundGrey"),
        foregroundBlack: "var(--foregroundBlack)",
        foregroundBlackDark: "var(--foregroundBlackDark)",

        placeholder: "var(--placeholder)",

        backgroundBox: "var(--backgroundBox)",
        backgroundBoxDarker: "var(--backgroundBoxDarker)",
        backgroundBoxHover: "var(--backgroundBoxHover)",
        backgroundBoxBox: variableColor("backgroundBoxBox"),
        backgroundBoxBoxDisabled: "var(--backgroundBoxBoxDisabled)",
        backgroundBoxBoxHover: "var(--backgroundBoxBoxHover)",
        backgroundBoxBoxHighlighted: variableColor("backgroundBoxBoxHighlighted"),
        backgroundBoxBoxHighlightedHover: "var(--backgroundBoxBoxHighlightedHover)",
        backgroundWhiteClock: "var(--backgroundWhiteClock)",
        backgroundBlackClock: "var(--backgroundBlackClock)",

        foregroundProfileWhite: "var(--foregroundProfileWhite)",
        foregroundProfileBlack: "var(--foregroundProfileBlack)",
        backgroundProfileWhite: "var(--backgroundProfileWhite)",
        backgroundProfileBlack: "var(--backgroundProfileBlack)",

        evaluationBarWhite: "var(--evaluationBarWhite)",
        evaluationBarBlack: "var(--evaluationBarBlack)",

        border: "var(--border)",
        borderHighlighted: "var(--borderHighlighted)",

        blackBoard: "var(--blackBoard)",
        whiteBoard: "var(--whiteBoard)",

        highlightBrilliant: "var(--highlightBrilliant)",
        highlightGreat: "var(--highlightGreat)",
        highlightBest: "var(--highlightBest)",
        highlightExcellent: "var(--highlightExcellent)",
        highlightGood: "var(--highlightGood)",
        highlightBook: "var(--highlightBook)",
        highlightInaccuracy: "var(--highlightInaccuracy)",
        highlightMistake: "var(--highlightMistake)",
        highlightMiss: "var(--highlightMiss)",
        highlightBlunder: "var(--highlightBlunder)",

        normalArrow: "var(--normalArrow)",
        bestArrow: "var(--bestArrow)",
        badArrow: "var(--badArrow)",

        winGreen: "var(--winGreen)",
        lossRed: "var(--lossRed)",

        error: "var(--error)",
        warning: "var(--warning)",

        // Permukaan tema tambahan (pass palet terang/gelap). Nilai gelapnya
        // persis warna hard-coded lama sehingga tema gelap tidak berubah;
        // tema terang memetakan ulang lewat --analisa-* di analisa.css.
        backgroundDropdown: variableColor("backgroundDropdown"),
        backgroundDropdownHover: variableColor("backgroundDropdownHover"),
        backgroundPanel: variableColor("backgroundPanel"),
        backgroundPanelHover: variableColor("backgroundPanelHover"),
        backgroundTrack: variableColor("backgroundTrack"),
        foregroundMuted: variableColor("foregroundMuted"),
        foregroundSwitchOff: variableColor("foregroundSwitchOff"),
        foregroundDestructive: variableColor("foregroundDestructive"),
        backgroundSlanted: variableColor("backgroundSlanted"),
        borderSlanted: variableColor("borderSlanted"),
      },
      borderRadius: {
        borderRoundness: "var(--borderRoundness)",
        borderExtraRoundness: "var(--borderExtraRoundness)",
      },
      boxShadow: {
        shadowBoxBoxHighlighted: "var(--shadowBoxBoxHighlighted) var(--backgroundBoxBoxHighlightedHover)",
      },
    },
    screens: {
      navTop: `${navTop}px`,
      sm: "640px",
      attributionsOneColumn: "700px",
      md: "768px",
      attributionsTwoColumns: "1000px",
      lg: "1024px",
      vertical: `${maxVertical}px`,
      xl: "1280px",
      reduceNav: "1280px",
      notFullDate: "1468px",
      "2xl": "1536px",
      reduceSummary: `${reduceSummary}px`,
    }
  },
  plugins: [],
} satisfies Config;
