/**
 * Point the native shell at the Vite dev server for hot reload.
 *
 * Usage:
 *   npm run cap:live              # emulator → 10.0.2.2; phone-only → LAN IP
 *   npm run cap:live -- ios       # iOS Simulator → http://127.0.0.1:5173 (sync ios only)
 *   npm run cap:live -- device    # Physical device → http://<LAN-IP>:5173
 *   CAP_SERVER_URL=http://192.168.1.10:5173 npm run cap:live -- ios
 *
 * Keep `npm run dev` running, then Run from Android Studio / Xcode.
 * To return to bundled assets: `npm run cap:sync`.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
	isEmulator,
	listDevices,
	parseSerial,
	resolveAdb,
} from "./adb-lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Skip Hyper-V / WSL adapters; prefer the Wi-Fi/LAN address the phone can reach. */
function lanIPv4() {
	const skipName =
		/vethernet|wsl|docker|virtualbox|vmware|hyper-v|loopback|bluetooth/i;
	const nets = networkInterfaces();
	const candidates = [];
	for (const [name, entries] of Object.entries(nets)) {
		if (!entries || skipName.test(name)) continue;
		for (const net of entries) {
			if (net.family === "IPv4" && !net.internal) {
				candidates.push(net.address);
			}
		}
	}
	return (
		candidates.find((address) => address.startsWith("192.168.")) ||
		candidates.find((address) => address.startsWith("10.")) ||
		candidates[0] ||
		null
	);
}

function requireLanViteUrl() {
	const ip = lanIPv4();
	if (!ip) {
		console.error(
			"No LAN IPv4 found. Set CAP_SERVER_URL=http://<your-pc-ip>:5173 and retry.",
		);
		process.exit(1);
	}
	return `http://${ip}:5173`;
}

function attachedAndroidTargets() {
	const { lines, error } = listDevices(resolveAdb());
	if (error) {
		console.log(`adb devices: ${error}`);
		return { phones: 0, emulators: 0 };
	}
	const online = lines.filter((line) => /\sdevice\b/.test(line));
	return {
		phones: online.filter((line) => !isEmulator(parseSerial(line))).length,
		emulators: online.filter((line) => isEmulator(parseSerial(line))).length,
	};
}

const mode = process.argv[2]; // "ios" | "android" | "device" | undefined
const platform =
	mode === "ios" || mode === "android" ? mode : undefined;

process.env.CAP_LIVE_RELOAD = "1";

if (!process.env.CAP_SERVER_URL) {
	if (mode === "ios") {
		// iOS Simulator can reach the Mac host on loopback.
		process.env.CAP_SERVER_URL = "http://127.0.0.1:5173";
	} else if (mode === "device") {
		process.env.CAP_SERVER_URL = requireLanViteUrl();
	} else {
		const { phones, emulators } = attachedAndroidTargets();
		if (phones > 0 && emulators === 0) {
			// 10.0.2.2 is emulator-only; a phone times out and the WebView stays black.
			process.env.CAP_SERVER_URL = requireLanViteUrl();
		} else {
			process.env.CAP_SERVER_URL = "http://10.0.2.2:5173";
			if (phones > 0) {
				console.log(
					"Warning: a physical device is also attached. 10.0.2.2 only works on the emulator. Use npm run adb:physical for the phone.",
				);
			}
		}
	}
}

const runHint =
	platform === "ios"
		? "Keep `npm run dev` running, then Run from Xcode."
		: platform === "android"
			? "Keep `npm run dev` running, then Run from Android Studio."
			: "Keep `npm run dev` running, then Run from Android Studio / Xcode.";

console.log(`Capacitor live reload → ${process.env.CAP_SERVER_URL}`);
console.log(runHint);

// Fresh clones may lack android/.../assets (generated files are gitignored).
// Capacitor fails writing capacitor.config.json if the directory is missing.
mkdirSync(resolve(root, "android/app/src/main/assets"), { recursive: true });

const syncArgs = platform ? ["cap", "sync", platform] : ["cap", "sync"];
const result = spawnSync("npx", syncArgs, {
	cwd: root,
	stdio: "inherit",
	shell: true,
	env: process.env,
});

process.exit(result.status ?? 1);
