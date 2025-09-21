import { BotConfig } from "../types/bot-config.js";
import fs from "fs";
import YAML from "yaml";
import url from "node:url";
import Bot from "./bot.js";
import util from "node:util";
import { ApplicationCommand, REST, Routes } from "discord.js";
import { archiveLatestLog, createLogger } from "../logger.js";

function getBotConfig(): BotConfig {
	const botConf = fs.readFileSync("./config/bot.yml", "utf8");
	return YAML.parseDocument(botConf, { merge: true }).toJS() as BotConfig;
}

async function main() {
	if (!process.env.NODE_ENV) {
		const dotenv = await import("@dotenvx/dotenvx");
		dotenv.config({ path: "./config/.env", logLevel: "error" });
	}
	const env = process.env.NODE_ENV || "development";
	const logUtil = createLogger("CommandPublisher", env);
	archiveLatestLog(logUtil.logsPath, logUtil.latestLogPath, logUtil.envPrefix);
	const { logger } = logUtil;

	logger.info("Loading configuration...");
	const botConfig = getBotConfig();

	// This bot will not have access to the database
	const bot = new Bot(botConfig, env);
	logger.info("Loading commands...");
	await bot.loadCommands();

	logger.info("Registering commands...");
	const rest = new REST().setToken(botConfig.token);

	const commands = bot.commands.map((command) => command.data.toJSON());
	logger.info(`Registering ${commands.length} commands...`);
	logger.debug(util.inspect(commands, { depth: Infinity }));

	try {
		const data = (await rest.put(
			Routes.applicationCommands(botConfig.clientId),
			{ body: commands }
		)) as Array<ApplicationCommand>;

		if (!Array.isArray(data))
			throw new Error("Failed to register commands.");

		logger.info(`Successfully registered ${data.length} application commands.`);
	} catch (error) {
		logger.error("Error registering commands:");
		logger.error(error);
	}
}

if (import.meta.url.startsWith("file:")) {
	const modulePath = url.fileURLToPath(import.meta.url);
	if (process.argv[1] === modulePath)
		void main();
}