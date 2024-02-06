import { cancel } from "@clack/prompts";
import chalk from "chalk";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { cwd } from "process";
import type { PackageJson } from "type-fest";
import { fileURLToPath } from "url";

export const bgSvelte = chalk.bgHex("#ff3e00");
const __dirname = fileURLToPath(new URL(".", import.meta.url));

export function cancelHandler(text?: string) {
	cancel(text ?? "Cancelled. Bye!");
	process.exit(1);
}

export const packageManager = get_package_manager() ?? "npm";

export function readPackageJson(cwd: string, directory = ".") {
	return JSON.parse(readFileSync(resolve(cwd, directory, "package.json"), "utf-8")) as PackageJson;
}

export async function editCwdPackageJson(callback: (json: PackageJson) => void | Promise<void>) {
	const filename = resolve(cwd(), "package.json");
	const packageJson = readFileSync(filename, "utf-8");
	const json = JSON.parse(packageJson) as PackageJson;
	await Promise.resolve()
		.then(() => callback(json))
		.then(() => {
			writeFileSync(filename, JSON.stringify(json, null, /\t/.test(packageJson) ? "\t" : 2) + "\n");
		});
}

export function editCwdFile(filename: string, callback: (content: string) => string) {
	const file = resolve(cwd(), filename);
	const content = readFileSync(file, "utf-8");
	const newContent = callback(content);
	if (newContent !== content) {
		writeFileSync(file, newContent);
	}
}

export function createCwdFile(filename: string, content: string) {
	const resolvedDestPath = resolve(
		cwd(),
		filename.includes("/") ? filename.substring(0, filename.lastIndexOf("/")) : ""
	);
	if (!existsSync(resolvedDestPath)) {
		mkdirSync(resolvedDestPath, { recursive: true });
	}
	const file = resolve(cwd(), filename);
	writeFileSync(file, content);
}

export function copyFromTemplateToCwd(filename: string, destPath: string) {
	const resolvedDestPath = resolve(cwd(), destPath);
	if (!existsSync(resolvedDestPath)) {
		mkdirSync(resolvedDestPath, { recursive: true });
	}
	cpSync(resolve(__dirname, "..", "template", filename), resolve(cwd(), destPath, filename), {
		force: true
	});
}

function get_package_manager() {
	if (!process.env.npm_config_user_agent) {
		return undefined;
	}
	const user_agent = process.env.npm_config_user_agent;
	const pm_spec = user_agent.split(" ")[0];
	const separator_pos = pm_spec?.lastIndexOf("/");
	const name = pm_spec?.substring(0, separator_pos);
	return name === "npminstall" ? "cnpm" : name;
}
