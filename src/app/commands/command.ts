import type { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder } from "discord.js";
import type { TranslateFn } from "../bot.js";
import type Bot from "../bot.js";
import type { Logger } from "winston";

export interface CommandMeta {
	ephemeral?: boolean;
	wouldDefer?: boolean;
	category: string;
}

export type ExecuteCommandFunction = (interaction: ChatInputCommandInteraction, bot: Bot, t: TranslateFn, logger: Logger) => Promise<void>
export type AutocompleteCommandOptionFunction = (interaction: AutocompleteInteraction, bot: Bot, t: TranslateFn, logger: Logger) => Promise<void>

export default interface Command {
	data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
	meta: CommandMeta;
	execute: ExecuteCommandFunction;
	autocomplete?: AutocompleteCommandOptionFunction;
// For some reason eslint thinks there is no semicolon here even though there is
// eslint-disable-next-line semi
};