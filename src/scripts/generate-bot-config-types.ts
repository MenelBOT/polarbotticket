import fs from "fs";
import path from "path";
import yaml, { Document } from "yaml";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputs = {
	Bot: {
		input: path.resolve(__dirname, "../../config/bot.yml"),
		output: path.resolve(__dirname, "../types/bot-config.d.ts")
	}
};

function isValidTSIdentifier(key: string) {
	return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key);
}

function toTSType(value: any, indent = 1): string {
	const pad = "\t".repeat(indent + 1);

	if (Array.isArray(value)) {
		if (value.length === 0) return "Array<any>";
		const types: Array<string> = [];

		for (const item of value) {
			const itemType = toTSType(item, indent + 1);
			types.push(itemType);
		}

		// If only one type, return it directly
		// If all types match same as above,
		// If more than one type, return as touple
		if (types.length === 1 || types.every(t => t === types[0]))
			return `Array<${types[0]}>`;
		else return `[${types.join(", ")}]`;
	}

	if (value === null || typeof value === "undefined") return "any";
	const type = typeof value;

	switch (type) {
	case "string":
	case "number":
	case "bigint":
	case "symbol":
	case "boolean": return type;
	}

	if (type !== "object") return "any";

	if (value instanceof Date) return "Date";
	if (value instanceof RegExp) return "RegExp";

	const entries = Object.entries(value as { [s: string]: unknown; })
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, val]) => {
			const safeKey = isValidTSIdentifier(key) ? key : `"${key}"`;
			return `${pad}${safeKey}: ${toTSType(val, indent + 1)}`;
		})
		.join(";\n");

	return `{\n${entries}\n${"\t".repeat(indent)}}`;
}

function generateInterface(configName: string, config: Document): string {
	const lines = Object.entries(config.toJS() as { [s: string]: unknown; })
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, value]) => {
			const safeKey = isValidTSIdentifier(key) ? key : `"${key}"`;
			const tsType = toTSType(value);
			return `\t${safeKey}: ${tsType};`;
		});

	return `// Auto-generated from ${configName.toLowerCase()}.yml\nexport interface ${configName}Config {\n${lines.join("\n")}\n}\n`;
}

function generate(configName: string, inputPath: string, outputPath: string) {
	const file = fs.readFileSync(inputPath, "utf8");
	const config = yaml.parseDocument(file, { merge: true });

	const output = generateInterface(configName, config);

	fs.writeFileSync(outputPath, output.replace(/\r?\n/g, "\r\n"), "utf8");
	console.log(`Type definition generated at ${outputPath}`);
}

for (const [key, { input, output }] of Object.entries(inputs))
	generate(key, input, output);