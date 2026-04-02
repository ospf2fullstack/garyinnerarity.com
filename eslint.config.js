import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    ignores: ["eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "script",
      globals: {
        // Browser globals
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        IntersectionObserver: "readonly",
        MutationObserver: "readonly",
        HTMLElement: "readonly",
        Event: "readonly",
        XMLHttpRequest: "readonly",
        // CDN libraries
        THREE: "readonly",
        marked: "readonly",
        hljs: "readonly",
        mermaid: "readonly",
        particlesJS: "readonly",
        $: "readonly",
      },
    },
    rules: {
      "no-undef": "warn",
      "no-unused-vars": ["warn", { args: "none" }],
      "no-redeclare": "error",
      "eqeqeq": ["warn", "smart"],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
    },
  },
  {
    files: [
      "generate-sitemap.js",
      "notes/generate-file-list.js",
      "skills/generate-file-list.js",
    ],
    languageOptions: {
      globals: {
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        process: "readonly",
      },
    },
  },
  {
    ignores: ["node_modules/", "**/*.min.js"],
  },
];
