import { cancel } from "@clack/prompts";
import chalk from "chalk";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { cwd } from "process";
import type { PackageJson } from "type-fest";

export const bgSvelte = chalk.bgHex("#ff3e00");

export function cancelHandler(text?: string) {
	cancel(text ?? "Cancelled. Bye!");
	process.exit(1);
}

export const packageManager = get_package_manager() ?? "npm";

export function readPackageJson(cwd: string, directory: string) {
	return JSON.parse(readFileSync(resolve(cwd, directory, "package.json"), "utf-8")) as PackageJson;
}

export async function editPackageJson(callback: (json: PackageJson) => void | Promise<void>) {
	const filename = resolve(cwd(), "package.json");
	const packageJson = readFileSync(filename, "utf-8");
	const json = JSON.parse(packageJson) as PackageJson;
	await Promise.resolve()
		.then(() => callback(json))
		.then(() => {
			writeFileSync(filename, JSON.stringify(json, null, /\t/.test(packageJson) ? "\t" : 2) + "\n");
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
