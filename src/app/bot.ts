import type {
	SendableChannels,
	Interaction
} from "discord.js";
import {
	Client,
	Collection,
	ChatInputCommandInteraction,
	Events,
	GatewayIntentBits,
	MessageFlags,
	AutocompleteInteraction
} from "discord.js";

import { REST, DiscordAPIError } from "@discordjs/rest";
import Command from "./commands/command.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { BotConfig } from "../types/bot-config.js";
import i18next from "./i18n.js";
import undici from "undici";
import type { Logger } from "winston";
import { createLogger } from "../logger.js";
import TicketHandler from "./handlers/ticket.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type TranslateFn = (key: string, options?: Record<string, any>) => string;

export enum SafetyVerificationResult {
	Denied = -1,
	Granted = 0,
	GuildOnly = 1,
	InvalidChannel = 2
}

export default class Bot {
	public readonly client: Client;
	public readonly restClient: REST;
	public readonly botConfig: BotConfig;
	public readonly categorizedCommands: Collection<string, Collection<string, Command>> = new Collection();
	public readonly handlers: { ticket: TicketHandler };
	public secureChannel: SendableChannels | undefined = undefined;
	public secureMode: boolean = true;
	public commands: Collection<string, Command> = new Collection();

	private lastSize: number = 0;
	private sizeInterval: NodeJS.Timeout | undefined = undefined;
	private readonly env: string;
	public readonly logger: Logger;
	private _ip: string | undefined;
	public get ip(): string {
		return this._ip ?? "unknown";
	}

	public translate(_interaction: Interaction, key: string, options?: Record<string, any>): string {
		return i18next.t(key, { lng: this.botConfig.language, ...options });
	}
	public t(interaction: Interaction, key: string, options?: Record<string, any>): string {
		return this.translate(interaction, key, options);
	}

	public constructor(botConfig: BotConfig, env: string) {
		this.env = env;
		this.logger = createLogger("DiscordBot", this.env).logger;
		this.botConfig = botConfig;
		this.secureMode = botConfig["C&C"].enable;

		this.client = new Client({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.MessageContent,
				GatewayIntentBits.GuildMessageReactions,
				GatewayIntentBits.GuildMembers,
				GatewayIntentBits.GuildModeration,
				GatewayIntentBits.DirectMessages,
				GatewayIntentBits.DirectMessageReactions
			]
		});

		this.restClient = new REST({ version: "10" }).setToken(this.botConfig.token);

		this.handlers = {
			ticket: new TicketHandler(this, this.env)
		};

		this.client.once(Events.ClientReady, async (readyClient) => {
			this.logger.info(`Logged in as ${readyClient.user.username}`);

			readyClient.user.setActivity(`Watching over ${readyClient.guilds.cache.size} servers!`);

			this.sizeInterval = setInterval((() => {
				const currentSize = this.client.guilds.cache.size;
				if (this.lastSize === currentSize) return;

				this.client.user!.setActivity(`Watching over ${currentSize} servers!`);
				this.lastSize = currentSize;
			}).bind(this), 10000);
			if (this.secureMode) await this.secureConnection();

			await this.handlers.ticket.load();

		});

		this.client.on(Events.InteractionCreate, async (interaction) => {
			if (interaction.isChatInputCommand())
				await this.handleSlashCommand(interaction);
			else if (interaction.isAutocomplete())
				await this.handleAutocomplete(interaction);
			else if (this.handlers.ticket.isTicketInteraction(interaction))
				await this.handlers.ticket.handle(interaction);
		});

		this.client.on(Events.MessageCreate, async (_message) => {
			// Tutaj wykonywać komendy tekstowe
		});
	}

	public async login() {
		this.logger.info("Logging in...");
		await this.loadCommands();
		await this.client.login(this.botConfig.token);
	}

	public static async getSubdirectories(directory: string): Promise<string[]> {
		const entries = await fs.readdir(directory);

		const dirs = await Promise.all(
			entries.map(async (entry) => {
				const fullPath = path.join(directory, entry);
				try {
					const stat = await fs.stat(fullPath);
					return stat.isDirectory() ? entry : null;
				} catch {
					return null; // skip if path is invalid or inaccessible
				}
			})
		);

		return dirs.filter((dir): dir is string => dir !== null);
	}

	public async loadCommands() {
		const categoriesPath = path.join(__dirname, "commands");
		const commandFolders = await Bot.getSubdirectories(categoriesPath);

		for (const category of commandFolders) {
			const categoryCollection = new Collection<string, Command>();
			this.categorizedCommands.set(category, categoryCollection);

			const commandsPath = path.join(categoriesPath, category);
			const commandFiles = (await fs.readdir(commandsPath)).filter(file => file.endsWith(".js"));

			for (const command of commandFiles) {
				const filePath = path.join(commandsPath, command);
				const commandFile = (await import(pathToFileURL(filePath).toString()) as { default: Command }).default;
				if (!("data" in commandFile && "execute" in commandFile))
					this.logger.warn(`Command file ${filePath} does not export a valid Command object.`);
				else {
					categoryCollection.set(commandFile.data.name, commandFile);
					this.commands.set(commandFile.data.name, commandFile);
				}
			}
		}
	}

	private async safeReplyToInteraction(interaction: ChatInputCommandInteraction, command: Command, content: string): Promise<void> {
		try {
			if (!interaction.replied && !command.meta.wouldDefer && interaction.isRepliable())
				await interaction.reply({ content: content, flags: MessageFlags.Ephemeral });
		} catch (error) {
			this.logger.error("Error replying to interaction:", error);
			if (error instanceof DiscordAPIError) {
				if (error.code === 10062)
					return; // Interaction unknown, means it was already acknowledged, or three seconds passed
			}
		}
	}

	private createTranslationFunction(interaction: Interaction): TranslateFn {
		return ((key: string, options?: Record<string, any>): string => {
			return this.translate(interaction, key, options);
		}).bind(this);
	}

	private verifySafety(interaction: ChatInputCommandInteraction): SafetyVerificationResult {
		if (!this.secureMode) return this.verifyIdentity(interaction);

		if (!interaction.inGuild())
			return SafetyVerificationResult.GuildOnly;

		if (interaction.channelId !== this.secureChannel!.id)
			return SafetyVerificationResult.InvalidChannel;

		return this.verifyIdentity(interaction);
	}

	private verifyIdentity(interaction: ChatInputCommandInteraction): SafetyVerificationResult {
		return this.botConfig.devlist.includes(interaction.user.id)
			? SafetyVerificationResult.Granted
			: SafetyVerificationResult.Denied;
	}

	private async handleDevCommand(interaction: ChatInputCommandInteraction, command: Command, t: TranslateFn) {
		const result = this.verifySafety(interaction);

		if (result === SafetyVerificationResult.Granted)
			return void await command.execute(interaction, this, t, this.logger);

		const errorMessages = {
			[SafetyVerificationResult.Denied]: "evalNotOwner",
			[SafetyVerificationResult.GuildOnly]: "guildOnlyCommand",
			[SafetyVerificationResult.InvalidChannel]: "invalidDevChannel"
		};

		await interaction.followUp({ content: t(errorMessages[result] ?? "commandError") });
	}

	private async handleSlashCommand(interaction: ChatInputCommandInteraction) {
		const command = this.commands.get(interaction.commandName);
		const translateFn = this.createTranslationFunction(interaction);

		if (!command) {
			this.logger.warn(`Command ${interaction.commandName} not found.`);
			return await interaction.reply({ content: translateFn("commandNotFound"), flags: MessageFlags.Ephemeral });
		}

		try {
			// If the command says it will defer, do it
			if (command.meta.wouldDefer)
				await interaction.deferReply({ flags: command.meta.ephemeral ? MessageFlags.Ephemeral : undefined });

			if (command.meta.category === "dev")
				await this.handleDevCommand(interaction, command, translateFn);
			else await command.execute(interaction, this, translateFn, this.logger);

			void this.safeReplyToInteraction(interaction, command, translateFn("commandSuccess"));
		} catch (error) {
			this.logger.error(`Error executing command ${interaction.commandName}:`, error);
			void interaction.followUp({ content: translateFn("commandError") });
		}
	}

	private async handleAutocomplete(interaction: AutocompleteInteraction) {
		const command = this.commands.get(interaction.commandName);

		if (!command)
			return void await interaction.respond([]); // No command to autocomplete

		if (!(command.autocomplete))
			return void await interaction.respond([]); // Command doesn't support autocomplete

		const translateFn = this.createTranslationFunction(interaction);

		return await command.autocomplete(interaction, this, translateFn, this.logger);
	}

	private async secureConnection() {
		const response = await undici.request("http://ipv4.icanhazip.com");
		if (response.statusCode !== 200)
			throw new Error("Cannot get own IP, security unavailable");

		const ip = await response.body.text();

		const channel = await (await this.client.guilds.fetch(this.botConfig["C&C"].server))?.channels.fetch(this.botConfig["C&C"].channel, { cache: true });
		if (!channel)
			throw new Error("Cannot establish connection to Command and Control channel!");

		if (!channel.isSendable())
			throw new Error("No permission to write to Command and Control channel!");

		this.secureChannel = channel;
		this._ip = ip;

		const message = `${this.client.user!.username} logged in from ${this.ip}`;
		this.logger.info(message);
		await channel.send(message);
	}
}