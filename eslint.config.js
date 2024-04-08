import js from "@eslint/js";
import ts from "typescript-eslint";
import prettier from "eslint-config-prettier";

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
	js.configs.recommended,
	...ts.configs.recommended,
	prettier,
	{
		rules: {
			// These off/not-configured-the-way-we-want lint rules we like & opt into
			"@typescript-eslint/no-explicit-any": "error",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{ argsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }
			],
			"@typescript-eslint/consistent-type-imports": [
				"error",
				{ prefer: "type-imports", fixStyle: "inline-type-imports" }
			],

			// These lint rules don't make sense for us but are enabled in the preset configs
			"@typescript-eslint/no-confusing-void-expression": "off",
			"@typescript-eslint/restrict-template-expressions": "off",

			// This rule doesn't seem to be working properly
			"@typescript-eslint/prefer-nullish-coalescing": "off"
		}
	},
	{
		ignores: ["template/", "dist/"]
	}
];
