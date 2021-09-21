import chalk from "chalk";
import * as cliCursor from "cli-cursor";
import * as readline from "readline";

// No idea how to detect whether the console font supports all the characters
const isLegacyConsole =
	process.platform === "win32" &&
	!(process.env.TERM_PROGRAM === "vscode" || !!process.env.WT_SESSION);

const ansiRegex = /(\u009B|\u001B\[)[0-?]*[ -\/]*[@-~]/g;

const spinnerInterval = 100;
const spinnerFrames = [
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

export default class Spinner {
	textSource: SpinnerTextSource | null = null;
	private lastTextSize: number = 0;
	private frame: number = 0;
	private frames: string[] = isLegacyConsole ? spinnerFramesCP437 : spinnerFrames;
	private interval: number = spinnerInterval;
	private enabled: boolean = true;
	private currentFrameWritten: boolean = false;

	private id: null | NodeJS.Timer = null;

	private stream = process.stderr;
	private outputIsTty =
		process.stdout.isTTY && process.stderr.isTTY && !(process.env.TERM === "dumb");

	clear() {
		if (!this.enabled || !this.outputIsTty) return;
		readline.clearLine(this.stream, 0);
		readline.cursorTo(this.stream, 0);
		this.lastTextSize = 0;
	}

	private getText() {
		return this.textSource ? this.textSource.getText() : "";
	}

	nextFrame() {
		if (!this.enabled || !this.outputIsTty) return;

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

	timerCallback() {
		this.currentFrameWritten = false;
		this.nextFrame();
	}

	start() {
		this.enabled = true;
		if (this.id !== null) clearInterval(this.id);
		this.nextFrame();
		this.id = setInterval(() => this.timerCallback(), this.interval);
		cliCursor.hide(this.stream);
	}

	pause() {
		if (this.id !== null) clearInterval(this.id);
		this.clear();
		cliCursor.show(this.stream);
		this.enabled = false;
	}

	stop() {
		this.pause();
		this.stream.write(chalk.cyan(this.getText()));
		this.enabled = false;
	}

	private textSize(t: string) {
		return t.replace(ansiRegex, "").length;
	}
}
