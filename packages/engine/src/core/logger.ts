import pino from "pino";

class Logger {
	logger: pino.Logger<never, boolean>;

	constructor() {
		this.logger = pino({}, {
			write(msg) {
				const pinoObject = JSON.parse(msg)
				const logDate = new Date(pinoObject.time).toISOString()
				const logMessage = pinoObject["0"]

				process.stdout.write(`[${logDate}] ${logMessage} \n`)
			}
		});
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
