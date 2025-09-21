import { Logger } from "winston";
import Handler from "./index.js";
import Bot from "../bot.js";
import { fileURLToPath } from "node:url";
import { createLogger } from "../../logger.js";
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, Collection, EmbedBuilder, ModalSubmitInteraction, StringSelectMenuInteraction, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageCreateOptions, Guild, GuildBasedChannel, Interaction, SendableChannels, GuildTextBasedChannel, FetchMessagesOptions, User, MessageFlags, ChannelType, CategoryChannel, ButtonStyle, MessageActionRowComponentBuilder } from "discord.js";
import fs from "node:fs";
import YAML from "yaml";
import path from "node:path";
import util from "node:util";

export interface TicketMenu {
    color: number
    title: string
    description: string
    footer: string
}

export interface TicketType {
    label: string
    description: string
    value: string
    emoji: string
    order: number
    category: string
}

export type TicketInteraction = ModalSubmitInteraction | ButtonInteraction | StringSelectMenuInteraction;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ticketConfigPath = path.join(__dirname, "..", "..", "..", "ticketConfig");
const ticketsPath = path.join(ticketConfigPath, "tickets");

export default class TicketHandler extends Handler {
	protected logger: Logger;
	private menu: TicketMenu = this.loadMenu();
	private categories: Collection<string, TicketType> = this.loadCategories();
	private loaded: boolean = false;
	private menuServer: Guild = undefined as unknown as Guild;
	private menuChannel: SendableChannels = undefined as unknown as SendableChannels;
	private logChannel: SendableChannels = undefined as unknown as SendableChannels;
	public constructor(protected readonly bot: Bot, protected readonly env: string) {
		super(bot, env);
		this.logger = createLogger("InmateHandler", this.env).logger;
	}

	public readonly actionColors = {
		create: 0x00ff00,
		claim: 0xffa500,
		close: 0xff0000,
		important: 0xffd700
	};
	public readonly actionNames = {
		create: "Utworzony",
		claim: "Przejęty",
		close: "Zamknięty",
		important: "Oznaczony jako ważny"
	};
	public readonly actionEmojis = {
		create: "🎫",
		claim: "✋",
		close: "🔒",
		important: "⭐"
	};

	public reload() {
		this.menu = this.loadMenu();
		this.categories = this.loadCategories();
	}

	public async load() {
		if (this.loaded) return;
		this.loaded = true;
		let server = this.bot.client.guilds.cache.get(this.bot.botConfig.tickets.guildId);
		if (!server) server = await this.bot.client.guilds.fetch(this.bot.botConfig.tickets.guildId);
		if (!server) throw new Error("Bot nie ma dostępu do serwera na którym ma utworzyć menu ticketów, albo taki serwer nie istnieje!");
		this.menuServer = server;

		let channel: GuildBasedChannel | null | undefined = server.channels.cache.get(this.bot.botConfig.tickets.menuChannel);
		if (!channel) channel = await server.channels.fetch(this.bot.botConfig.tickets.menuChannel);
		if (!channel) throw new Error("Bot nie ma dostępu do kanału na którym ma utworzyć menu ticketów, albo taki kanał nie istnieje na podanym serwerze!");
		if (!channel.isSendable()) throw new Error("Kanał na którym bot ma wysłać menu ticketów nie jest kanałem na który można wysyłać wiadomości!");
		this.menuChannel = channel;

		let logChannel: GuildBasedChannel | null | undefined = server.channels.cache.get(this.bot.botConfig.tickets.logsChannel);
		if (!logChannel) logChannel = await server.channels.fetch(this.bot.botConfig.tickets.logsChannel);
		if (!logChannel) throw new Error("Bot nie ma dostępu do kanału na którym ma wysyłać zapisy ticketów, albo takowy kanał nie istnieje");
		if (!logChannel.isSendable()) throw new Error("Kanał na którym bot ma wysyłać zapisy ticketów nie jest kanałem na który można wysyłać wiadomości!");
		this.logChannel = logChannel;

		await channel.send(this.createMenuPayload());
	}

	public isTicketInteraction(interaction: Interaction): interaction is TicketInteraction {
		return ("customId" in interaction && (interaction.customId.startsWith(this.bot.botConfig.tickets.modals.closeTicket) || Object.values(this.bot.botConfig.tickets.modals).includes(interaction.customId)) && !interaction.channel?.isDMBased());
	}

	public createMenuPayload() {
		const embed = new EmbedBuilder()
			.setTitle(this.menu.title)
			.setDescription(this.menu.description)
			.setFooter({ text: this.menu.footer })
			.setColor(this.menu.color)
			.setTimestamp();

		const firstFive = Array.from(this.categories.entries()).slice(0, 5);
		const components = firstFive.map(((el: [string, TicketType]) => {
			const style = ([1, 2, 3, 4].includes(el[1].order) ? el[1].order : 1) as 1 | 2 | 3 | 4;

			return new ButtonBuilder()
				.setCustomId(this.bot.botConfig.tickets.modals.createTicket + el[0])
				.setLabel(el[1].label)
				.setStyle(style)
				.setEmoji(el[1].emoji);
		}).bind(this));
		const buttonRow = new ActionRowBuilder().setComponents(components);

		const selectOptions = this.categories.map((ticketType) => {
			return new StringSelectMenuOptionBuilder()
				.setLabel(ticketType.label)
				.setDescription(ticketType.description)
				.setValue(ticketType.value)
				.setEmoji(ticketType.emoji);
		});

		const selectComponent = new StringSelectMenuBuilder()
			.setCustomId(this.bot.botConfig.tickets.modals.ticketCategory)
			.setPlaceholder("Wybierz kategorie ticketu")
			.addOptions(selectOptions);

		const selectRow = new ActionRowBuilder().setComponents(selectComponent);

		return {
			embeds: [embed],
			components: [buttonRow, selectRow]
		} as MessageCreateOptions;
	}

	public async handle(interaction: TicketInteraction) {
		if (!this.loaded) return void this.logger.warn("Nie można obsłużyć interakcji, ponieważ bot wciąż się uruchamia!");

		if (interaction.isModalSubmit())
			await this.handleModal(interaction);
		else if (interaction.isStringSelectMenu())
			await this.handleSelectionCreate(interaction);
		else if (interaction.customId.startsWith("create_ticket_"))
			await this.handleInstantCreate(interaction);
		else {
			switch(interaction.customId) {
			case this.bot.botConfig.tickets.modals.closeTicket: {
				await this.handleClose(interaction);
				break;
			}
			case this.bot.botConfig.tickets.modals.claimTicket: {
				await this.handleClaim(interaction);
				break;
			}
			case this.bot.botConfig.tickets.modals.priorityTicket: {
				await this.handleMarkImportant(interaction);
				break;
			}
			default: break;
			}
		}
	}

	private loadMenu(): TicketMenu {
		const menu = fs.readFileSync(path.join(ticketConfigPath, "menu.yml"), "utf-8");
		return YAML.parseDocument(menu, { merge: true }).toJS() as TicketMenu;
	}

	private loadCategories(): Collection<string, TicketType> {
		const ticketFiles = fs.readdirSync(ticketsPath).filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"));
		const tickets = new Collection<string, TicketType>();

		for (const ticketFilePath of ticketFiles) {
			const filePath = path.join(ticketsPath, ticketFilePath);
			const ticketFile = fs.readFileSync(filePath, "utf-8");
			const ticket: TicketType = YAML.parseDocument(ticketFile, { merge: true }).toJS() as TicketType;
			const key = path.parse(ticketFilePath).name;
			if (tickets.has(key))
				this.logger.error(`Kategoria ticketa ${key} już istnieje, nadpisuję następną znalezioną kategorią o tej samej nazwie ${filePath}`);
			tickets.set(key, ticket);
		}

		const entries = Array.from(tickets.entries());

		const withOrder = entries.filter(([_, v]) => v.order !== 0);
		const zeroOrder = entries.filter(([_, v]) => v.order === 0);

		withOrder.sort((a, b) => a[1].order - b[1].order);

		return new Collection([...withOrder, ...zeroOrder]);
	}

	private async handleModal(interaction: ModalSubmitInteraction) {
		try {
			const channel = interaction.channel as GuildTextBasedChannel | null;
			const closeReason = interaction.fields.getTextInputValue(this.bot.botConfig.tickets.modals.closeReason);

			if (!channel) {
				this.logger.error("Interakcja zamknięcia ticketa nie powiodła się ponieważ nie zawiera żadnego ticketa!");
				this.logger.error(util.inspect(interaction, { depth: null, colors: true }));
				return;
			}

			const channelName = channel.name.replace(/^⭐/, ""); // Usuń gwiazdkę jeśli jest
			const data = channelName.match(/^\d{4}-(.+)-(.+)/);
			let ticketOwner = null;

			await interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setColor(0xff0000)
						.setTitle("🔒 Ticket zostanie zamknięty")
						.setDescription(`**Powód:** ${closeReason}\n\nKanał zostanie usunięty za chwilę...`)
						.setTimestamp()
				]
			});

			await this.logTicketActionWithReason("close", interaction.user, channel, closeReason);

			if (data) {
				const username = data[1];
				const category = data[2];

				ticketOwner = this.menuServer.members.cache.find((member) =>
					member.user.username.toLowerCase().replace(/[^a-z0-9]/g, "") === username
				);

				const allMessages = [];
				let lastMessageId = null;

				while (true) {
					const options: FetchMessagesOptions = { limit: 100 };
					if (lastMessageId)
						options.before = lastMessageId;


					const messages = await channel.messages.fetch(options);
					if (messages.size === 0) break;

					allMessages.push(...messages.values());
					lastMessageId = messages.last()!.id;
				}

				allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

				let conversationText = "";

				allMessages.forEach((message) => {
					const timestamp = new Date(message.createdTimestamp).toLocaleString("pl-PL");
					let content = message.content || "";
					message.embeds.forEach((embed) => {
						const text = `[Embed: ${embed.title?.slice(0, 32) ?? "Embed bez tytułu"}]`;
						if (content.length == 0) content = text;
						else content += `\n${text}`;
					});
					message.attachments.forEach((attachment) => {
						const text = `[Załącznik ${attachment.name}: ${attachment.url}]`;
						if (content.length == 0) content = text;
						else content += `\n${text}`;
					});

					if (content.length != 0)
						conversationText += `[${timestamp}] ${message.author.tag}: ${content}\n`;

				});

				if (conversationText.length == 0)
					conversationText = "Brak zapisanych wiadomości w tym tickecie.\n";


				const maxLength = 3800;
				const chunks = [];

				if (conversationText.length <= maxLength)
					chunks.push(conversationText);
				else {
					let chunk = "";
					const lines = conversationText.split("\n");

					for (const line of lines) {
						const formatted = chunk + line + "\n";
						if (formatted.length > maxLength) {
							chunks.push(chunk);
							chunk = line + "\n";
						} else chunk = formatted;
					}
					if (chunk.length > 0) chunks.push(chunk);
				}

				const logEmbeds = this.collectArray(chunks.map((chunk, i) => new EmbedBuilder()
					.setColor(0x2b2d31)
					.setTitle(`📄 Część ${i + 1}/${chunks.length}`)
					.setDescription(`\`\`\`\n${chunk}\`\`\``)
					.setTimestamp()
				));

				if (ticketOwner) {
					const userFacingEmbed = new EmbedBuilder()
						.setColor(0xff0000)
						.setTitle("🔒 Twój ticket został zamknięty")
						.setDescription(
							`**Serwer:** ${this.menuServer.name}\n` +
                        `**Kategoria:** ${category}\n` +
                        `**Zamknięty przez:** ${interaction.user.tag}\n` +
                        `**Powód zamknięcia:** ${closeReason}\n` +
                        `**Czas zamknięcia:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
                        "Dziękujemy za skorzystanie z naszego wsparcia! 🙏\n" +
                        "W razie potrzeby możesz utworzyć nowy ticket."
						)
						.setFooter({ text: "System ticketów" })
						.setTimestamp();

					const logPreemptEmbed = new EmbedBuilder()
						.setColor(0x5865f2)
						.setTitle("📜 Zapis Twojej rozmowy z ticketu")
						.setDescription(`Poniżej znajdziesz zapis rozmowy z Twojego ticketu #${channel.name}:`)
						.setTimestamp();

					await ticketOwner.send({ embeds: [userFacingEmbed, logPreemptEmbed] });

					for (let i = 0; i < logEmbeds.length; i++) {
						await new Promise((resolve) => setTimeout(resolve, 500));
						await ticketOwner.send({ embeds: logEmbeds[i] });
					}
				}
				for (let i = 0; i < logEmbeds.length; i++) {
					await new Promise((resolve) => setTimeout(resolve, 500));
					await this.logChannel.send({ embeds: logEmbeds[i] });
				}
			}


			setTimeout(async () => {
				try {
					await channel.delete();
				} catch (error) {
					console.error("Błąd podczas usuwania kanału:", error);
				}
			}, 5000);
		} catch { void 0; }
	}
	private async handleInstantCreate(interaction: ButtonInteraction) {
		const category = interaction.customId.replace(this.bot.botConfig.tickets.modals.createTicket, "");
		await this.createTicket(interaction, category);
	}
	private async handleSelectionCreate(interaction: StringSelectMenuInteraction) {
		const category = interaction.values[0] ?? "";
		await this.createTicket(interaction, category);
	}

	// TODO
	// TODO
	// TODO
	private async handleClose(interaction: ButtonInteraction) {}
	private async handleClaim(interaction: ButtonInteraction) {}
	private async handleMarkImportant(interaction: ButtonInteraction) {}
	// TODO
	// TODO
	// TODO

	private collectArray<T>(array: Array<T>, size = 10): Array<Array<T>> {
		const result = [];
		for (let i = 0; i < array.length; i += size)
			result.push(array.slice(i, i + size));

		return result;
	}

	private async logTicketAction(action: keyof TicketHandler["actionColors"], user: User, channel: GuildTextBasedChannel, category: string | null = null) {
		try {
			const embed = new EmbedBuilder()
				.setColor(this.actionColors[action])
				.setTitle(`${this.actionEmojis[action]} Ticket ${this.actionNames[action]}`)
				.addFields(
					{ name: "👤 Użytkownik", value: `${user.displayName} (${user.tag})`, inline: true },
					{ name: "📍 Kanał", value: `${channel.name}`, inline: true },
					{ name: "🕐 Czas", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
				)
				.setTimestamp();

			if (category)
				embed.addFields({ name: "📂 Kategoria", value: category, inline: true });


			await this.logChannel.send({ embeds: [embed] });

		} catch (error) {
			console.error("Błąd podczas logowania:", error);
		}
	}

	private async logTicketActionWithReason(action: keyof TicketHandler["actionColors"], user: User, channel: GuildTextBasedChannel, reason: string | null = null) {
		try {
			const embed = new EmbedBuilder()
				.setColor(this.actionColors[action])
				.setTitle(`${this.actionEmojis[action]} Ticket ${this.actionNames[action]}`)
				.addFields(
					{ name: "👤 Użytkownik", value: `${user.displayName} (${user.tag})`, inline: true },
					{ name: "📍 Kanał", value: `${channel.name}`, inline: true },
					{ name: "🕐 Czas", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
				)
				.setTimestamp();

			if (reason)
				embed.addFields({ name: "📝 Powód", value: reason, inline: false });


			await this.logChannel.send({ embeds: [embed] });

		} catch (error) {
			console.error("Błąd podczas logowania:", error);
		}
	}

	private async createTicket(interaction: StringSelectMenuInteraction | ButtonInteraction, category: string) {
		try {
			const user = interaction.user;

			// Sprawdź czy użytkownik już ma otwarty ticket
			const existingChannel = this.menuServer.channels.cache.find((channel) =>
				channel.name.includes(`${user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}-${category}`)
			);

			if (existingChannel) {
				return await interaction.reply({
					content: "❌ Masz już otwarty ticket w tej kategorii!",
					flags: MessageFlags.Ephemeral
				});
			}

			const ticketCategoryData = this.categories.get(category);

			if (!ticketCategoryData) {
				return await interaction.reply({
					content: "❌ Kategoria ticketa którą wybrałeś nie istnieje!",
					flags: MessageFlags.Ephemeral
				});
			}

			const ticketCategoryId = ticketCategoryData?.category;
			if (!ticketCategoryId) {
				return await interaction.reply({
					content: "❌ Kategoria ticketa którą wybrałeś nie ma przypisanej kategorii na serwerze discord, zgłoś to administracji tak szybko jak możesz!",
					flags: MessageFlags.Ephemeral
				});
			}

			let ticketCategory: GuildBasedChannel | null | undefined = this.menuServer.channels.cache.get(ticketCategoryId);
			if (!ticketCategory) ticketCategory = await this.menuServer.channels.fetch(ticketCategoryId);
			if (!ticketCategory) {
				return await interaction.reply({
					content: "❌ Kategoria ticketa którą wybrałeś nie ma przypisanej kategorii na serwerze discord, zgłoś to administracji tak szybko jak możesz!",
					flags: MessageFlags.Ephemeral
				});
			}
			if (!(ticketCategory instanceof CategoryChannel)) {
				return await interaction.reply({
					content: "❌ Kategoria ticketa którą wybrałeś ma przypisany kanał na serwerze discord który nie jest kategorią, zgłoś to administracji tak szybko jak możesz!",
					flags: MessageFlags.Ephemeral
				});
			}

			const ticketNumber = this.getNextTicketNumber();

			const ticketChannel = await this.menuServer.channels.create({
				name: `${ticketNumber}-${user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}-${category}`,
				type: ChannelType.GuildText,
				parent: ticketCategoryId, // Kategoria kanałów
			});

			await ticketChannel.permissionOverwrites.edit(
				this.menuServer.roles.everyone.id,
				{ ViewChannel: false }
			);
			await ticketChannel.permissionOverwrites.edit(
				user.id,
				{
					ViewChannel: true,
					SendMessages: true,
					ReadMessageHistory: true,
					EmbedLinks: true,
					AttachFiles: true,
					UseExternalEmojis: true,
					UseExternalStickers: true
				}
			);


			const embed = new EmbedBuilder()
				.setColor(0x00ff00)
				.setTitle(`${ticketCategoryData.emoji} Ticket - ${category.toUpperCase()}`)
				.setDescription(
					`Witaj ${user.displayName}!\n\n` +
                    `**Kategoria:** ${category}\n` +
                    "**Status:** 🟢 Otwarty\n\n" +
                    "Opisz swój problem lub pytanie, a nasz zespół pomoże Ci tak szybko, jak to możliwe!\n\n" +
                    "⏰ **Średni czas odpowiedzi:** 5-15 minut"
				)
				.setFooter({ text: `Ticket utworzony przez ${user.tag}` })
				.setTimestamp();

			const buttons = [
				new ButtonBuilder()
					.setCustomId(this.bot.botConfig.tickets.modals.claimTicket)
					.setLabel("Przejmij Ticket")
					.setStyle(ButtonStyle.Primary)
					.setEmoji("✋"),
				new ButtonBuilder()
					.setCustomId(this.bot.botConfig.tickets.modals.priorityTicket)
					.setLabel("Ustaw jako ważne")
					.setStyle(ButtonStyle.Secondary)
					.setEmoji("⭐"),
				new ButtonBuilder()
					.setCustomId(this.bot.botConfig.tickets.modals.closeTicket)
					.setLabel("Zamknij Ticket")
					.setStyle(ButtonStyle.Danger)
					.setEmoji("🔒")
			];

			const ticketButtons = new ActionRowBuilder<MessageActionRowComponentBuilder>()
				.setComponents(buttons);

			await ticketChannel.send({
				content: `<@${user.id}>`,
				embeds: [embed],
				components: [ticketButtons]
			});

			// Wyślij log o utworzeniu ticketu
			await this.logTicketAction("create", user, ticketChannel, category);

			await interaction.reply({
				content: `✅ Ticket został utworzony: <#${ticketChannel.id}>`,
				ephemeral: true
			});

		} catch (error) {
			console.error("Błąd podczas tworzenia ticketu:", error);
			await interaction.reply({
				content: "❌ Wystąpił błąd podczas tworzenia ticketu!",
				ephemeral: true
			});
		}
	}

	private getNextTicketNumber() {
		const ticketChannels = this.menuServer.channels.cache.filter(channel =>
			/^\d{4}-/.test(channel.name)
		);

		const numbers = ticketChannels.map(channel => {
			const match = channel.name.match(/^(\d{4})-/);
			return match ? parseInt(match[1] ?? "0", 10) : 0;
		});

		const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
		const nextNumber = maxNumber + 1;

		return nextNumber.toString().padStart(4, "0");
	}
}