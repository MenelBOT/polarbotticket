import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
	// Base JS/TS support with recommended rules
	js.configs.recommended,
	...tseslint.configs.recommendedTypeChecked,
	{
		files: ["**/*.{js,ts,mjs,cjs}"],

		languageOptions: {
			ecmaVersion: 2021,
			sourceType: "module", // ESM instead of CommonJS
			globals: {
				...globals.node,
				...globals.es2021,
			},
			parserOptions: {
				ecmaVersion: 2021,
				sourceType: "module",
				projectService: {
					allowDefaultProject: [
						"eslint.config.mjs",
						"generate-migration.js",
						"run-migrations.js"
					]
				},
				tsconfigRootDir: import.meta.dirname,
			}
		},

		rules: {
			indent: ["error", "tab"],
			quotes: ["error", "double"],
			semi: ["error", "always"],
			"brace-style": ["error", "1tbs", { allowSingleLine: true }],
			"comma-dangle": ["error", {
				arrays: "only-multiline",
				objects: "only-multiline",
				imports: "only-multiline",
				exports: "only-multiline",
				functions: "only-multiline"
			}],
			"comma-spacing": "error",
			"comma-style": "error",
			curly: ["error", "multi-or-nest"],
			"dot-location": ["error", "property"],
			"handle-callback-err": "off",
			"linebreak-style": ["error", "unix"],
			"max-nested-callbacks": ["error", { max: 4 }],
			"max-statements-per-line": ["error", { max: 2 }],
			"no-console": "off",
			"no-extra-semi": "off",
			"no-empty-function": "error",
			"no-floating-decimal": "error",
			"no-lonely-if": "error",
			"no-multi-spaces": "error",
			"no-multiple-empty-lines": ["error", { max: 2, maxEOF: 1, maxBOF: 0 }],
			"no-shadow": ["error", { allow: ["err", "resolve", "reject"] }],
			"no-trailing-spaces": ["error"],
			"no-var": "error",
			"object-curly-spacing": ["error", "always"],
			"prefer-const": "warn",
			"space-before-blocks": "error",
			"space-before-function-paren": ["error", {
				anonymous: "never",
				named: "never",
				asyncArrow: "always"
			}],
			"space-in-parens": "error",
			"space-infix-ops": "error",
			"space-unary-ops": "error",
			"spaced-comment": "error",
			yoda: "error",
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-deprecated": "error",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					"args": "all",
					"argsIgnorePattern": "^_",
					"caughtErrors": "all",
					"caughtErrorsIgnorePattern": "^_",
					"destructuredArrayIgnorePattern": "^_",
					"varsIgnorePattern": "^_",
					"ignoreRestSiblings": true
				}
			],
			"@typescript-eslint/no-misused-promises": [
				"error",
				{ "checksVoidReturn": false }
			]
		}
	},

	{
		// Ignore top level JS files as they are meant to be scripts, not project code
		ignores: ["deprecated_node_modules/", "node_modules", "src/migrations/**/*", "generate-migration.js", "run-migrations.js", "dist/**/*"]
	}
]);