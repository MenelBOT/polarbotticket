// Auto-generated from bot.yml
export interface BotConfig {
	"C&C": {
		channel: string;
		enable: boolean;
		server: string
	};
	clientId: string;
	devlist: Array<string>;
	language: string;
	prefix: string;
	tickets: {
		guildId: string;
		logsChannel: string;
		menuChannel: string;
		modals: {
			claimTicket: string;
			closeModal: string;
			closeReason: string;
			closeTicket: string;
			createTicket: string;
			priorityTicket: string;
			ticketCategory: string
		};
		supportRoles: Array<string>
	};
	token: string;
}
