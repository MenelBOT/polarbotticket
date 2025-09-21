import { SlashCommandBuilder } from "discord.js";
import type Command from "../command.js";

const ping: Command = {
	data: new SlashCommandBuilder()
		.setName("ping")
		.setDescription("Replies with Pong!"),
	meta: {
		ephemeral: true,
		wouldDefer: true,
		category: "utility"
	},
	execute: async (interaction, _bot, t, _logger) => {
		const now = Date.now();

		const ms = now - interaction.createdTimestamp;

		await interaction.followUp(await t("pingOutput", { ms }));
	}
};

export default ping;