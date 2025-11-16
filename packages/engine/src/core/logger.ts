import pino from "pino";
import pretty from "pino-pretty";

class Logger {
	logger: pino.Logger<never, boolean>;

	constructor() {
		this.logger = pino(pretty());
	}

	trace(...args: unknown[]) {
		this.logger.trace(args);
	}

	debug(...args: unknown[]) {
		this.logger.debug(args);
	}

	info(...args: unknown[]) {
		this.logger.info(args);
	}

	warn(...args: unknown[]) {
		this.logger.warn(args);
	}

	error(...args: unknown[]) {
		this.logger.error(args);
	}
}

export default new Logger();
