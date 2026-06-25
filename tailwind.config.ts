
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-nunito)", "system-ui", "sans-serif"],
        nunito: ["var(--font-nunito)", "system-ui", "sans-serif"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        
        primary: {
          bg: "var(--color-primary-bg)",
          0: "var(--color-primary-0)",
          1: "var(--color-primary-1)",
          2: "var(--color-primary-2)",
          3: "var(--color-primary-3)",
          4: "var(--color-primary-4)",
          5: "var(--color-primary-5)", // Color principal de marca (Solid)
          6: "var(--color-primary-6)",
          7: "var(--color-primary-7)", // Texto principal sobre fondos claros (Fg)
          8: "var(--color-primary-8)",
          9: "var(--color-primary-9)",
          DEFAULT: "var(--color-primary-5)",
        },
        secondary: {
          0: "var(--color-secondary-0)",
          1: "var(--color-secondary-1)",
          2: "var(--color-secondary-2)",
          3: "var(--color-secondary-3)",
          4: "var(--color-secondary-4)",
          5: "var(--color-secondary-5)",
          6: "var(--color-secondary-6)",
          7: "var(--color-secondary-7)",
          8: "var(--color-secondary-8)",
          9: "var(--color-secondary-9)",
          DEFAULT: "var(--color-secondary-5)",
        },
        gray: {
          0: "var(--color-gray-0)",   // Blanco
          1: "var(--color-gray-1)",
          2: "var(--color-gray-2)",
          3: "var(--color-gray-3)",   // Bordes suaves
          4: "var(--color-gray-4)",
          5: "var(--color-gray-5)",   // Texto secundario claro
          6: "var(--color-gray-6)",
          7: "var(--color-gray-7)",   // Texto secundario oscuro
          8: "var(--color-gray-8)",
          9: "var(--color-gray-9)",   // Texto principal
          10: "var(--color-gray-10)", // Negro casi absoluto
        },
        info: {
          1: "var(--color-info-1)",   // Subtle
          5: "var(--color-info-5)",   // Solid
          7: "var(--color-info-7)",   // Fg
          9: "var(--color-info-9)",
          DEFAULT: "var(--color-info-5)",
        },
        success: {
          1: "var(--color-success-1)",
          5: "var(--color-success-5)",
          7: "var(--color-success-7)",
          9: "var(--color-success-9)",
          DEFAULT: "var(--color-success-5)",
        },
        warning: {
          1: "var(--color-warning-1)",
          5: "var(--color-warning-5)",
          7: "var(--color-warning-7)",
          9: "var(--color-warning-9)",
          DEFAULT: "var(--color-warning-5)",
        },
        critique: {
          1: "var(--color-critique-1)", // Muted / Subtle
          2: "var(--color-critique-2)",
          3: "var(--color-critique-3)",
          5: "var(--color-critique-5)", // Solid para algunos estados
          6: "var(--color-critique-6)", // Solid principal de error
          7: "var(--color-critique-7)", // Fg
          9: "var(--color-critique-9)",
          DEFAULT: "var(--color-critique-6)", // Por defecto al rojo sólido
        },
      },
      borderRadius: {
        'sm': '0.125rem',  // Checkboxes
        DEFAULT: '0.25rem', // Base
        'md': '0.375rem',  // Botones e inputs (según SVG)
        'lg': '0.5rem',    // Tarjetas y modales pequeños
        'xl': '0.75rem',   // Modales grandes
      },
      screens: {
        'masivo': '1150px',
      },
      boxShadow: {
        // Sombras suaves basadas en la UI del SaaS que se muestra en tus imágenes
        'card': '0px 2px 4px rgba(10, 27, 21, 0.05), 0px 4px 6px rgba(10, 27, 21, 0.05)',
        'modal': '0px 10px 15px -3px rgba(10, 27, 21, 0.1), 0px 4px 6px -4px rgba(10, 27, 21, 0.05)',
        'popover': '0px 4px 6px -1px rgba(10, 27, 21, 0.1), 0px 2px 4px -2px rgba(10, 27, 21, 0.1)',
      }
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    // Aquí puedes incluir plugins como @tailwindcss/forms si usas muchos inputs nativos
  ],
};

export default config;