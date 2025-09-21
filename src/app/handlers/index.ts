import type { Logger } from "winston";
import Bot from "../bot.js";

export default abstract class Handler {
	protected abstract logger: Logger
	public constructor(protected readonly bot: Bot, protected readonly env: string) {}
}