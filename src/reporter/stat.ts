import * as os from "os";

interface CpuTime {
	total: number;
	idle: number;
}

function getCpuStats() {
	const cpus = os.cpus();
	let stats: CpuTime[] = [];
	for (let cpu of cpus) {
		const idle = cpu.times.idle;
		const total = idle + cpu.times.user + cpu.times.nice + cpu.times.irq + cpu.times.sys;
		stats.push({ idle, total });
	}
	return stats;
}

export class CpuStats {
	private lastGetTime = Date.now();
	private lastUsage = 0;
	private lastStat = getCpuStats();

	getTotalCpuUsage() {
		const currentTime = Date.now();
		if (currentTime - this.lastGetTime < 1000) {
			return this.lastUsage;
		} else {
			const currentStat = getCpuStats();
			let count = 0,
				totalUsage = 0;
			for (let j = 0; j < currentStat.length && this.lastStat.length; j++) {
				const idleDiff = currentStat[j].idle - this.lastStat[j].idle;
				const totalDiff = currentStat[j].total - this.lastStat[j].total;
				totalUsage += 1 - idleDiff / totalDiff;
				count += 1;
			}
			this.lastStat = currentStat;
			this.lastGetTime = currentTime;
			const usage = count ? Math.min(1, Math.max(0, totalUsage / count)) : 0;
			this.lastUsage = usage;
			return usage;
		}
	}
}

export class MemStats {
	private lastGetTime = Date.now();
	private lastUsage = 0;
	getMemoryUsage() {
		const currentTime = Date.now();
		if (currentTime - this.lastGetTime < 1000) {
			return this.lastUsage;
		} else {
			const totalMem = os.totalmem();
			const freeMem = os.freemem();
			const usage = 1 - freeMem / totalMem;
			this.lastUsage = usage;
			return usage;
		}
	}
}
