import {
	confirm,
	group,
	intro,
	multiselect,
	note,
	outro,
	select,
	spinner,
	text
} from "@clack/prompts";
import chalk from "chalk";
import { execSync } from "child_process";
import { create as createSvelte } from "create-svelte";
import { existsSync, readdirSync } from "fs";
import { basename, resolve } from "path";
import { argv, chdir, cwd } from "process";
import { init as tailwindInit } from "tailwindcss/lib/cli/init/index.js";
import { fileURLToPath } from "url";
import {
	bgSvelte,
	cancelHandler,
	copyFromTemplateToCwd,
	createCwdFile,
	editCwdFile,
	editCwdPackageJson,
	packageManager,
	readPackageJson
} from "./utils.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

async function main() {
	console.clear();
	console.log();

	const packageJson = readPackageJson(__dirname, "..");
	intro(
		bgSvelte.white.bold(
			` ${packageJson.name ?? "create-wih-app"} v${packageJson.version ?? "1.0.0"} `
		)
	);

	const project = await group(
		{
			// App name
			appName: () =>
				text({
					message: "What's the name of your SvelteKit app?",
					placeholder: "my-app"
				}).then(name => {
					if (typeof name === "symbol") {
						return name;
					}
					return name ?? argv[2] ?? ".";
				}),
			// App path check
			pathCheck: ({ results }) => {
				if (!results.appName) {
					// should never happen but the typing is weird
					cancelHandler();
					return undefined;
				}
				if (existsSync(results.appName) && readdirSync(results.appName).length > 0) {
					return confirm({
						message: `Directory "${basename(resolve(results.appName))}" is not empty. Continue?`,
						initialValue: false
					});
				}
				return undefined;
			},
			// TypeScript support
			typescript: ({ results }) => {
				if (results.pathCheck === false) {
					cancelHandler();
				}
				return select({
					message: "Do you want to use TypeScript or JavaScript?",
					options: [
						{
							label: "TypeScript",
							value: true,
							hint: "Recommended"
						},
						{
							label: "JavaScript",
							value: false,
							hint: "Don't forget about JSDoc!"
						}
					]
				});
			},
			// Features
			features: () =>
				multiselect({
					message: "Select the features you want to add",
					options: [
						{
							label: "TailwindCSS",
							value: "tailwind",
							hint: "A utility-first CSS framework"
						},
						{
							label: "Prettier",
							value: "prettier",
							hint: "Code formatter. Recommended"
						},
						{
							label: "ESLint",
							value: "eslint",
							hint: "Linter. Recommended"
						},
						{
							label: "Vitest",
							value: "vitest",
							hint: "Vite-powered unit testing framework"
						},
						{
							label: "Playwright",
							value: "playwright",
							hint: "End-to-end browser testing"
						}
					],
					initialValues: ["tailwind", "prettier", "eslint"]
				}),
			// Libraries
			library: ({ results }) => {
				return undefined;
				type Library = "shadcn";
				if (!results.features?.includes("tailwind")) return;

				return select<
					{ label?: string; value: Library | "none"; hint?: string }[],
					Library | "none"
				>({
					message: "Select the UI library you want to add",
					options: [
						...(results.features?.includes("tailwind")
							? [
									{
										label: "shadcn-svelte",
										value: "shadcn" as const,
										hint: "A Svelte port of the famous shadcn/ui library"
									}
								]
							: []),
						// Skeleton? other?
						{
							label: "None",
							value: "none",
							hint: "No UI library"
						}
					]
				});
			},
			// CI/CD
			ci: () =>
				multiselect({
					message: "Select CI/CD solutions",
					options: [
						{
							label: "Renovate",
							value: "renovate",
							hint: "Keep NPM dependencies up-to-date. GitHub only"
						},
						{
							label: "Husky",
							value: "husky",
							hint: "Cross-platform Git hooks"
						},
						{
							label: "Automatic PR assignment workflow",
							value: "pr-auto-assign",
							hint: "Automatically assign PRs to their author. GitHub only"
						}
						// auto-release? build?
					],
					initialValues: ["renovate", "husky"],
					required: false
				}),
			// Final confirmation
			confirm: () =>
				confirm({
					message: "Confirm the selected options?"
				})
		},
		{ onCancel: () => cancelHandler() }
	);

	if (!project.confirm) cancelHandler();

	// Start installation
	const s = spinner();
	s.start("Setting up your project");
	await createSvelte(project.appName, {
		name: basename(resolve(project.appName)),
		types: project.typescript ? "typescript" : "checkjs",
		eslint: project.features.includes("eslint"),
		playwright: project.features.includes("playwright"),
		prettier: project.features.includes("prettier"),
		vitest: project.features.includes("vitest"),
		template: "skeleton"
	});
	chdir(project.appName);
	editCwdFile("README.md", () => {
		return `# ${project.appName}\n\nSvelteKit app bootstrapped with [create-wih-app](https://github.com/WarningImHack3r/create-wih-app).\n\n## Run the app\n\n\`\`\`sh\n${packageManager} dev\n\`\`\`\n`;
	});

	s.message("Initializing a git repository");
	try {
		execSync("git init");
	} catch (error) {
		console.error("Error initializing git repository. Is git installed?", error);
	}

	// Install dependencies
	s.message("Updating dependencies");
	await editCwdPackageJson(async json => {
		json.version = "1.0.0";
		async function latestVersion(name: string) {
			return await fetch(`https://registry.npmjs.org/${name}/latest`)
				.then(r => {
					return r.json() as Promise<{ version: string }>;
				})
				.then(json => json.version);
		}
		if (json.dependencies) {
			for (const dependency of Object.keys(json.dependencies)) {
				json.dependencies[dependency] = `^${await latestVersion(dependency)}`;
			}
		}
		if (json.devDependencies) {
			for (const dependency of Object.keys(json.devDependencies)) {
				json.devDependencies[dependency] = `^${await latestVersion(dependency)}`;
			}
		}
	});
	s.message("Installing dependencies");
	execSync(`${packageManager} install`);

	const additionalDeps: string[] = [];
	// Libraries
	if (project.features.includes("tailwind")) {
		s.message("Installing TailwindCSS");
		additionalDeps.push("tailwindcss", "autoprefixer", "postcss");
		const consoleLog = console.log;
		console.log = () => {
			// suppress tailwind init logs, only telling "file created" or "file already exists"
		};
		tailwindInit({
			// simulates npx tailwindcss init -p (--ts)
			_: ["init"],
			"--postcss": true,
			...(project.typescript ? { "--ts": true } : {})
		});
		console.log = consoleLog;
		// Update tailwind.config.js
		const configPath = readdirSync(cwd()).find(file => file.startsWith("tailwind.config."));
		if (!configPath) {
			cancelHandler("Error: TailwindCSS config not found");
			return;
		}
		editCwdFile(configPath, content => {
			return content.replace("content: []", 'content: ["./src/**/*.{html,js,svelte,ts}"]');
		});
		// Create files
		createCwdFile("src/app.css", "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n");
		createCwdFile(
			"src/routes/+layout.svelte",
			`<script${project.typescript ? ' lang="ts"' : ""}>\n\timport "../app.css";\n</script>\n\n<slot />\n`
		);
		// Prettier plugin
		if (project.features.includes("prettier")) {
			additionalDeps.push("prettier-plugin-tailwindcss");
		}

		/*if (project.library === "shadcn") {
			// TODO: setup + mode-watcher + navbar
			s.message("Installing shadcn-svelte");
			execSync(`${"pnpx"} shadcn-svelte@latest init -y`);
		}*/
	}

	// CI/CD
	if (project.ci.includes("renovate")) {
		s.message("Creating Renovate config file");
		copyFromTemplateToCwd("renovate.json", ".github");
	}
	if (project.ci.includes("husky")) {
		s.message("Setting up Husky");
		// Install husky
		await editCwdPackageJson(json => {
			json.scripts = { ...(json.scripts ?? {}), prepare: "husky" };
		});
		additionalDeps.push("husky");
		// Create husky scripts
		// pre-commit lint, post-checkout cleanup
		createCwdFile(
			".husky/pre-commit",
			`FILES=$(git diff --cached --name-only --diff-filter=ACMR | sed 's| |\\ |g')\n[ -z "$FILES" ] && exit 0\n\necho "$FILES" | xargs ${packageManager} format\n\necho "$FILES" | xargs git add\n`
		);
		createCwdFile(".husky/post-commit", "git update-index -g\n");
		createCwdFile(
			".husky/post-checkout",
			`if [ "$3" == 1 ]; then\n\t${packageManager} install\n\tgit fetch -p\n\tnpx git-removed-branches -p -f\nfi\n`
		);
	}
	if (project.ci.includes("pr-auto-assign")) {
		s.message("Creating PR auto-assign workflow");
		copyFromTemplateToCwd("pr-auto-assign.yml", ".github/workflows");
		const actionVersion = await fetch(
			"https://api.github.com/repos/toshimaru/auto-author-assign/releases/latest"
		)
			.then(res => res.json() as Promise<{ tag_name: string }>)
			.then(json => json.tag_name);
		editCwdFile(".github/workflows/pr-auto-assign.yml", content => {
			return content.replace(/%VERSION%/, actionVersion);
		});
	}

	// Additional dependencies
	if (additionalDeps.length > 0) {
		s.message("Installing additional dependencies");
		execSync(`${packageManager} install --save-dev ${additionalDeps.join(" ")}`);
	}

	// ESLint rules
	if (project.features.includes("eslint")) {
		s.message("Improving ESLint config file");
		const eslintConfig = readdirSync(cwd()).find(file => file === "eslint.config.js");
		if (!eslintConfig) {
			cancelHandler("Error: ESLint config not found");
			return;
		}
		editCwdFile(eslintConfig, content => {
			return content.replace(
				"{\n\t\tignores:",
				`{\n\t\trules: {\n\t\t\t"@typescript-eslint/method-signature-style": ["error", "property"],\n\t\t\t"@typescript-eslint/no-import-type-side-effects": "error"\n\t\t}\n\t},\n\t{\n\t\tignores:`
			);
		});
	}

	// Prettier
	if (project.features.includes("prettier")) {
		s.message("Improving Prettier config file and formatting files");
		copyFromTemplateToCwd(".prettierrc", ".");
		if (project.features.includes("tailwind")) {
			// Add "prettier-plugin-tailwindcss" to Prettier config
			editCwdFile(".prettierrc", content => {
				return content
					.replace(
						/"prettier-plugin-svelte"/,
						'"prettier-plugin-svelte", "prettier-plugin-tailwindcss"'
					)
					.replace(
						/'prettier-plugin-svelte']/,
						"'prettier-plugin-svelte', 'prettier-plugin-tailwindcss']"
					);
			});
		}
		execSync(`${packageManager} format`);
	}

	s.stop("Project set up!");

	// Final notes
	const postInstallSteps = [`cd ${project.appName}`, `${packageManager} dev`];
	const additionalNotes = [
		...(project.ci.includes("renovate")
			? [
					`You chose to use Renovate. Don't forget to set up the Renovate bot on GitHub:\n${chalk.cyan.underline("https://docs.renovatebot.com/getting-started/installing-onboarding/#hosted-githubcom-app")}`
				]
			: [])
	].filter(Boolean);
	let i = 1;
	note(
		postInstallSteps.map(step => `${i++}. ${step}`).join("\n") +
			(additionalNotes.length > 0
				? "\n\nAdditional notes:\n- " + additionalNotes.join("\n- ")
				: ""),
		"Next steps:"
	);

	outro(
		`${chalk.green.bold("Done!")} ${chalk.dim("Problems?")} ${chalk.cyan.underline("https://github.com/WarningImHack3r/create-wih-app/issues/new")}`
	);
}

main().catch(error => {
	console.error(error);
	cancelHandler("An error occurred. Exiting...");
});
