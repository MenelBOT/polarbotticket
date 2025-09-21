import fs from "fs";
import YAML from "yaml";
import * as url from "node:url";
import packageConfig from "../rewrite/package.json" with { type: "json" };
import Bot from "./app/bot.js";
import type { BotConfig } from "./types/bot-config.js";
import { archiveLatestLog, createLogger } from "./logger.js";
import { Logger } from "winston";
import util from "node:util";
import { isDebugEnabledCached as isDebugEnabled } from "./utils/debug.js";

function hookLifecycle(logger: Logger) {
	process.on("uncaughtException", (error, origin) => {
		logger.error("Uncaught Exception:");
		console.error(error);
		logger.error(util.inspect(error));
		logger.error(util.inspect(origin));


		// Ensure logs are flushed before exit
		setTimeout(() => {
			process.exit(process.exitCode ?? 1);
		}, 2000);
		logger.debug("ending");
		logger.end();
	});
	logger.debug("Registered uncaughtException handler");

	process.on("unhandledRejection", (reason, promise) => {
		logger.on("finish", () => {
			process.exit(process.exitCode ?? 1);
		});
		logger.error("Unhandled Promise Rejection:");
		logger.error(util.inspect(reason));
		logger.error(util.inspect(promise));
		setTimeout(() => {
			process.exit(process.exitCode ?? 1);
		}, 2000);
		logger.debug("ending");
		logger.end();
	});
	logger.debug("Registered unhandledRejection handler");

	["SIGINT", "SIGTERM", "SIGHUP"].forEach((signal) => {
		process.on(signal, () => {
			logger.on("finish", () => {
				process.exit(process.exitCode ?? 1);
			});
			logger.error(`Received termination signal ${signal}!`);
			logger.error("Exiting...");
			setTimeout(() => {
				process.exit(process.exitCode ?? 1);
			}, 2000);
			logger.debug("ending");
			logger.end();
		});
		logger.debug(`Registered ${signal} handler`);
	});
}

export function getBotConfig(): BotConfig {
	const botConf = fs.readFileSync("./config/bot.yml", "utf8");
	return YAML.parseDocument(botConf, { merge: true }).toJS() as BotConfig;
}

async function main() {
	const dotenv = await import("@dotenvx/dotenvx");
	dotenv.config({ path: "./config/.env", logLevel: "error" });
	const env = process.env.NODE_ENV || "development";

	console.log("Initializing logger...");

	const {
		envPrefix,
		latestLogPath,
		logger,
		logsPath
	} = createLogger("Main", env);
	archiveLatestLog(logsPath, latestLogPath, envPrefix);

	logger.info("Log file rotated");
	logger.info("Logger initialized!");

	logger.info(`Loading ${packageConfig.name} v${packageConfig.version} in ${env} mode...`);

	logger.info("Registering lifecycle hooks");
	hookLifecycle(logger);
	logger.info("Complete!");

	logger.info("Loading bot...");
	const botConfig = getBotConfig();
	const bot = new Bot(botConfig, env);

	await bot.login();

	logger.info("Bot loaded!");
}

if (import.meta.url.startsWith("file:")) {
	const modulePath = url.fileURLToPath(import.meta.url);
	if (process.argv[1] === modulePath)
		void main();
}