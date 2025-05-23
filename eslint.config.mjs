// @ts-nocheck
import globals from "globals";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";

export default tseslint.config(
	{
		ignores: [
			"node_modules/",
			"dist/",
			".github/",
			".idea/",
			".vscode/",
			"src-tauri/",
			"vite.config.ts",
			"eslint.config.mjs",
		],
	},
	eslint.configs.recommended,
	tseslint.configs.strictTypeChecked,
	tseslint.configs.stylisticTypeChecked,
	pluginReact.configs.flat.recommended,
	{
		files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
		rules: {
			"@typescript-eslint/dot-notation": "off",
			"@typescript-eslint/no-unused-vars": "off",
			"no-multi-spaces": 2,
			"comma-dangle": [2, "always-multiline"],
			"@typescript-eslint/ban-ts-comment": 2,
			"@typescript-eslint/restrict-template-expressions": 0,
			"@typescript-eslint/no-unsafe-member-access": 0,

			/**
			 * Preact / JSX rules
			 */
			"react/no-deprecated": 2,
			"react/react-in-jsx-scope": 0, // handled this automatically
			"react/display-name": [1, { ignoreTranspilerName: false }],
			"react/jsx-no-bind": [1, {
				ignoreRefs: true,
				allowFunctions: true,
				allowArrowFunctions: true,
			}],
			"react/jsx-no-comment-textnodes": 2,
			"react/jsx-no-duplicate-props": 2,
			"react/jsx-no-target-blank": 2,
			"react/jsx-no-undef": 2,
			"react/jsx-tag-spacing": [2, { beforeSelfClosing: "always" }],
			"react/jsx-uses-react": 2, // debatable
			"react/jsx-uses-vars": 2,
			"react/jsx-key": [2, { checkFragmentShorthand: true }],
			"react/self-closing-comp": 2,
			"react/prefer-es6-class": 2,
			"react/prefer-stateless-function": 1,
			"react/require-render-return": 2,
			"react/no-danger": 1,
			// Legacy APIs not supported in Preact:
			"react/no-did-mount-set-state": 2,
			"react/no-did-update-set-state": 2,
			"react/no-find-dom-node": 2,
			"react/no-is-mounted": 2,
			"react/no-string-refs": 2,

			/**
			 * General JavaScript error avoidance
			 */
			"constructor-super": 2,
			"no-caller": 2,
			"no-const-assign": 2,
			"no-delete-var": 2,
			"no-dupe-class-members": 2,
			"no-dupe-keys": 2,
			"no-duplicate-imports": 2,
			"no-else-return": 1,
			"no-empty-pattern": 0,
			"no-empty": 0,
			"no-extra-parens": 0,
			"no-iterator": 2,
			"no-lonely-if": 2,
			"no-mixed-spaces-and-tabs": [1, "smart-tabs"],
			"no-multi-str": 1,
			"no-new-wrappers": 2,
			"no-proto": 2,
			"no-redeclare": 2,
			"no-shadow-restricted-names": 2,
			"no-shadow": 0,
			"no-spaced-func": 2,
			"no-this-before-super": 2,
			"no-undef-init": 2,
			"no-unneeded-ternary": 2,
			"no-unused-vars": "off",
			"no-useless-call": 1,
			"no-useless-computed-key": 1,
			"no-useless-concat": 1,
			"no-useless-constructor": 1,
			"no-useless-escape": 1,
			"no-useless-rename": 1,
			"no-var": 1,
			"no-with": 2,

			/**
			 * General JavaScript stylistic rules (disabled)
			 */
			semi: 2,
			strict: [2, "never"], // assume type=module output (cli default)
			"object-curly-spacing": [2, "always"],
			"rest-spread-spacing": 0,
			"space-before-function-paren": [0, "always"],
			"space-in-parens": [0, "never"],
			"object-shorthand": 1,
			"prefer-arrow-callback": 1,
			"prefer-rest-params": 1,
			"prefer-spread": 1,
			"prefer-template": 1,
			quotes: [2, "double"],
			"quote-props": "off",
			radix: 1, // parseInt(x, 10)
			"unicode-bom": 2,
			"valid-jsdoc": 0,
		},
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
			globals: globals.browser,
		},
		settings: {
			// Preact CLI provides these defaults
			targets: ["last 2 versions"],
			polyfills: ["fetch", "Promise"],
			react: {
				// eslint-plugin-preact interprets this as "h.createElement",
				// however we only care about marking h() as being a used variable.
				pragma: "h",
				// We use "react 16.0" to avoid pushing folks to UNSAFE_ methods.
				version: "16.0",
			},
		},
	},
	{
		files: ["**/*.d.ts"],
		rules: {
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": "off",
		},
	}
);
