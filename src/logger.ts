import fs from "fs";
import path from "path";
import winston from "winston";

const envMapping = {
	"production": "prod",
	"development": "dev",
	"testing": "test"
} as const;

type EnvMapping = typeof envMapping;

type EnvProxy = {
	[K in keyof EnvMapping]: EnvMapping[K];
} & {
	[key: string]: string; // allow unknown keys too
};

const envProxy: EnvProxy = new Proxy(envMapping, {
	get(target, prop, _receiver) {
		if (typeof prop !== "string")
			return prop;

		if (prop in target)
			return target[prop as keyof typeof target];
		return prop;
	}
});

function getNextArchiveName(dateStr: string, logsPath: string, envPrefix: string): string {
	let counter = 0;
	let candidate = path.join(logsPath, `${dateStr}.${envPrefix}.log`);

	while (fs.existsSync(candidate)) {
		counter++;
		candidate = path.join(logsPath, `${dateStr}-${counter}.${envPrefix}.log`);
	}

	return candidate;
}

export function archiveLatestLog(logsPath: string, latestLogPath: string, envPrefix: string) {
	if (!fs.existsSync(latestLogPath)) return;

	const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
	const newPath = getNextArchiveName(dateStr, logsPath, envPrefix);

	fs.renameSync(latestLogPath, newPath);
}

export function createLogger(serviceName: string, env?: string): { envPrefix: string, logsPath: string, latestLogPath: string, logger: winston.Logger } {
	const envPrefix = envProxy[env ?? process.env.NODE_ENV ?? "development"]!;
	const LOG_DIR = "logs";
	const LATEST_LOG = path.join(LOG_DIR, `latest.${envPrefix}.log`);

	if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

	const logger = winston.createLogger({
		level: "info",
		format: winston.format.combine(
			winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
			winston.format.printf(({ timestamp, level, message }) =>
				`[${timestamp as string}] [${serviceName}] (${level.toUpperCase()}): ${message as string}`
			),
		),
		transports: [
			new winston.transports.Console({
				format: winston.format.combine(
					winston.format.colorize(),
					winston.format.printf(({ level, message, timestamp }) =>
						`[${timestamp as string}] [${serviceName}] [${level}]: ${message as string}`
					)
				),
			}),
			new winston.transports.File({ filename: LATEST_LOG, level: "debug" })
		]
	});

	return { envPrefix, logsPath: LOG_DIR, latestLogPath: LATEST_LOG, logger };
}

export function info(message: string, logger: winston.Logger | Console): void {
	if (logger instanceof winston.Logger)
		logger.info(message);
	else logger.log(message);
}

export function warn(message: string, logger: winston.Logger | Console): void {
	logger.warn(message);
}

export function fatal(message: string, logger: winston.Logger | Console): void {
	logger.error(message);
	process.exit(1);
}