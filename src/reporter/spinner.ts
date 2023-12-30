import chalk from "chalk";
import * as cliCursor from "cli-cursor";
import * as readline from "readline";

// No idea how to detect whether the console font supports all the characters
const isLegacyConsole =
	process.platform === "win32" &&
	!(process.env.TERM_PROGRAM === "vscode" || !!process.env.WT_SESSION);

const ansiRegex = /(\u009B|\u001B\[)[0-?]*[ -\/]*[@-~]/g;

const SpinnerFastInterval = 10; // 100 fps
const SpinnerSlowInterval = 50; // 20 fps
const SpinnerFrames = [
	"⢀⠀",
	"⡀⠀",
	"⠄⠀",
	"⢂⠀",
	"⡂⠀",
	"⠅⠀",
	"⢃⠀",
	"⡃⠀",
	"⠍⠀",
	"⢋⠀",
	"⡋⠀",
	"⠍⠁",
	"⢋⠁",
	"⡋⠁",
	"⠍⠉",
	"⠋⠉",
	"⠋⠉",
	"⠉⠙",
	"⠉⠙",
	"⠉⠩",
	"⠈⢙",
	"⠈⡙",
	"⢈⠩",
	"⡀⢙",
	"⠄⡙",
	"⢂⠩",
	"⡂⢘",
	"⠅⡘",
	"⢃⠨",
	"⡃⢐",
	"⠍⡐",
	"⢋⠠",
	"⡋⢀",
	"⠍⡁",
	"⢋⠁",
	"⡋⠁",
	"⠍⠉",
	"⠋⠉",
	"⠋⠉",
	"⠉⠙",
	"⠉⠙",
	"⠉⠩",
	"⠈⢙",
	"⠈⡙",
	"⠈⠩",
	"⠀⢙",
	"⠀⡙",
	"⠀⠩",
	"⠀⢘",
	"⠀⡘",
	"⠀⠨",
	"⠀⢐",
	"⠀⡐",
	"⠀⠠",
	"⠀⢀",
	"⠀⡀",
];

const spinnerFramesCP437 = ["-", "\\", "|", "/"];

export interface SpinnerTextSource {
	getText(): string;
}

enum SpinnerState {
	Stopped = 0, // Spinner is stopped. Nothing to happen.
	Starting = 1, // Spinner is starting. It will show the message at next frame.
	Running = 2, // Spinner is running.
	Paused = 3, // Spinner is paused.
}

export default class Spinner {
	textSource: SpinnerTextSource | null = null;
	private lastTextSize: number = 0;
	private frame: number = 0;
	private frames: string[] = isLegacyConsole ? spinnerFramesCP437 : SpinnerFrames;
	private interval: number = SpinnerFastInterval;

	private state: SpinnerState = SpinnerState.Stopped;
	private timer: null | NodeJS.Timer = null;
	private currentFrameWritten: boolean = false;

	private stream = process.stderr;
	private outputIsTty =
		process.stdout.isTTY && process.stderr.isTTY && !(process.env.TERM === "dumb");

	private clear() {
		if (!this.outputIsTty) return;
		cliCursor.show(this.stream);
		readline.clearLine(this.stream, 0);
		readline.cursorTo(this.stream, 0);
		this.lastTextSize = 0;
	}

	private getText() {
		return this.textSource ? this.textSource.getText() : "";
	}

	private nextFrame() {
		switch (this.state) {
			case SpinnerState.Stopped:
				return this.handleStopped();
			case SpinnerState.Starting:
				return this.handleStarting();
			case SpinnerState.Paused:
				return this.handlePaused();
			case SpinnerState.Running:
				return this.handleRunning();
		}
	}
	private handleStopped() {
		if (this.timer != null) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}
	private handleStarting() {
		if (this.timer == null) {
			this.interval = SpinnerFastInterval;
			this.timer = setInterval(() => this.timerCallback(), this.interval);
		}

		this.state = SpinnerState.Running;
	}
	private handleRunning() {
		if (this.timer === null || this.interval === SpinnerFastInterval) {
			this.interval = SpinnerSlowInterval;
			if (this.timer != null) clearInterval(this.timer);
			this.timer = setInterval(() => this.timerCallback(), this.interval);
		}

		if (!this.outputIsTty) return;

		cliCursor.hide(this.stream);
		readline.cursorTo(this.stream, 0);
		const text = this.getText();
		const sizeText = this.textSize(text);
		const trailing =
			sizeText < this.lastTextSize ? " ".repeat(this.lastTextSize - sizeText) : "";
		this.stream.write(chalk.cyan(this.frames[this.frame]) + " " + text + trailing);
		this.lastTextSize = sizeText;
		if (!this.currentFrameWritten) this.frame = (this.frame + 1) % this.frames.length;
		this.currentFrameWritten = true;
	}
	private handlePaused() {
		if (this.timer != null) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}
	private timerCallback() {
		this.currentFrameWritten = false;
		this.nextFrame();
	}

	start() {
		if (this.state === SpinnerState.Running || this.state === SpinnerState.Starting) return;
		this.state = SpinnerState.Starting;
		this.nextFrame();
	}

	pause() {
		if (this.state === SpinnerState.Stopped || this.state === SpinnerState.Paused) return;
		if (this.state === SpinnerState.Running) this.clear();
		this.state = SpinnerState.Paused;
		this.nextFrame();
	}

	stop() {
		if (this.state === SpinnerState.Stopped) return;
		if (this.state === SpinnerState.Running) this.clear();
		this.state = SpinnerState.Stopped;
		this.nextFrame();
		this.stream.write(chalk.cyan(this.getText()));
	}

	private textSize(t: string) {
		return t.replace(ansiRegex, "").length;
	}
}
