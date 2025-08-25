const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const os = require("os");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function getStoragePath() {
	const platform = os.platform();

	if (platform === "win32") {
		return path.join(process.env.LOCALAPPDATA, "LinkeyLauncher");
	}
	if (platform === "darwin") {
		return path.join(
			os.homedir(),
			"Library/Application Support/LinkeyLauncher"
		);
	}
	if (platform === "linux") {
		return path.join(os.homedir(), ".config/linkey-launcher");
	}

	throw new Error(`Unsupported platform: ${platform}`);
}

const storageDir = getStoragePath();
const storageFile = path.join(storageDir, "enabledProfiles.json");

// Enabled profiles now stored as Map<key, { browser, dirName }>
function enabledKey(browser, dirName) {
	return `${browser}::${dirName}`;
}

function loadEnabledProfiles() {
	try {
		if (!fs.existsSync(storageDir))
			fs.mkdirSync(storageDir, { recursive: true });
		if (fs.existsSync(storageFile)) {
			const raw = fs.readFileSync(storageFile, "utf8");
			const parsed = JSON.parse(raw);
			const map = new Map();
			if (Array.isArray(parsed)) {
				parsed.forEach((entry) => {
					// Legacy format: string dirName only
					if (typeof entry === "string") {
						// Skip legacy ambiguous entries; user will re-toggle to persist with browser context
						return;
					}
					if (entry && entry.browser && entry.dirName) {
						map.set(enabledKey(entry.browser, entry.dirName), {
							browser: entry.browser,
							dirName: entry.dirName,
						});
					}
				});
			}
			return map;
		}
	} catch (err) {
		console.warn("⚠️ Could not load enabledProfiles.json:", err);
	}
	return new Map();
}

function saveEnabledProfiles() {
	try {
		if (!fs.existsSync(storageDir))
			fs.mkdirSync(storageDir, { recursive: true });
		const arr = [...enabledProfiles.values()];
		fs.writeFileSync(storageFile, JSON.stringify(arr, null, 2));
	} catch (err) {
		console.error("❌ Failed to save enabledProfiles.json:", err);
	}
}

let enabledProfiles = loadEnabledProfiles();

function getProfileBaseDirs() {
	const platform = os.platform();

	if (platform === "win32") {
		const localAppData = process.env.LOCALAPPDATA;

		return [
			{
				browser: "Chrome",
				path: path.join(localAppData, "Google/Chrome/User Data"),
				exe: "start chrome",
			},
			{
				browser: "Chromium",
				path: path.join(localAppData, "Chromium/User Data"),
				exe: "start chromium",
			},
			{
				browser: "Brave",
				path: path.join(
					localAppData,
					"BraveSoftware/Brave-Browser/User Data"
				),
				exe: "start brave",
			},
		];
	}

	const home = os.homedir();
	if (platform === "darwin") {
		return [
			{
				browser: "Chrome",
				path: path.join(
					home,
					"Library/Application Support/Google/Chrome"
				),
				exe: 'open -na "Google Chrome" --args',
			},
			{
				browser: "Chromium",
				path: path.join(home, "Library/Application Support/Chromium"),
				exe: 'open -na "Chromium" --args',
			},
			{
				browser: "Brave",
				path: path.join(
					home,
					"Library/Application Support/BraveSoftware/Brave-Browser"
				),
				exe: 'open -na "Brave Browser" --args',
			},
		];
	}

	if (platform === "linux") {
		return [
			{
				browser: "Chrome",
				path: path.join(home, ".config/google-chrome"),
				exe: "google-chrome",
			},
			{
				browser: "Chromium",
				path: path.join(home, ".config/chromium-browser"),
				exe: "chromium-browser",
			},
			{
				browser: "Brave",
				path: path.join(home, ".config/brave-browser"),
				exe: "brave-browser",
			},
		];
	}

	throw new Error(`Unsupported platform: ${platform}`);
}

function readProfileNames(basePath) {
	const localStatePath = path.join(basePath, "Local State");
	try {
		const content = fs.readFileSync(localStatePath, "utf8");
		const json = JSON.parse(content);
		return json.profile?.info_cache || {};
	} catch (err) {
		console.warn(`⚠️ Could not read Local State at ${localStatePath}`);
		return {};
	}
}

function detectProfiles() {
	const bases = getProfileBaseDirs();
	let profiles = [];

	bases.forEach(({ browser, path: basePath, exe }) => {
		try {
			const dirs = fs.readdirSync(basePath, { withFileTypes: true });
			const profileNames = readProfileNames(basePath);

			dirs.forEach((d) => {
				if (
					d.isDirectory() &&
					(d.name === "Default" || d.name.startsWith("Profile"))
				) {
					const friendlyName = profileNames[d.name]?.name || d.name;

					const key = enabledKey(browser, d.name);
					profiles.push({
						browser,
						dirName: d.name,
						name: friendlyName,
						command: `${exe} --profile-directory="${d.name}"`,
						enabled: enabledProfiles.has(key),
					});
				}
			});
		} catch (err) {
			console.warn(`Could not read ${browser} profiles at ${basePath}`);
		}
	});

	return profiles;
}

// Build a quick browser->exe map for launching without rescanning
function buildExeMap() {
	const map = new Map();
	getProfileBaseDirs().forEach(({ browser, exe }) => map.set(browser, exe));
	return map;
}
let browserExeMap = buildExeMap();

app.post("/open", (req, res) => {
	const { url } = req.body;
	if (!url) return res.status(400).send("Missing URL");

	const enabledList = [...enabledProfiles.values()];
	if (enabledList.length === 0) {
		return res.status(500).send("No enabled profiles found");
	}

	enabledList.forEach(({ browser, dirName }) => {
		const exe = browserExeMap.get(browser);
		if (!exe) {
			console.warn(`No executable mapping for browser ${browser}`);
			return;
		}
		const fullCommand = `${exe} --profile-directory="${dirName}" "${url}"`;
		exec(fullCommand, (err) => {
			if (err)
				console.error(`Error opening in ${browser} (${dirName}):`, err);
			else console.log(`Opened ${url} in ${browser}:${dirName}`);
		});
	});

	res.send(`Opening ${url} in ${enabledList.length} enabled profiles...`);
});

app.get("/profiles", (_req, res) => {
	res.json(detectProfiles());
});

app.post("/toggle-profile", (req, res) => {
	const { dirName, browser } = req.body;
	if (!dirName) return res.status(400).send("Missing profile dirName");

	// If browser provided, use direct key
	if (browser) {
		const key = enabledKey(browser, dirName);
		if (enabledProfiles.has(key)) {
			enabledProfiles.delete(key);
			saveEnabledProfiles();
			return res.json({ dirName, browser, enabled: false });
		}
		enabledProfiles.set(key, { browser, dirName });
		saveEnabledProfiles();
		return res.json({ dirName, browser, enabled: true });
	}

	// No browser given: attempt to infer uniquely via detection (backward compatibility with old client)
	const matches = detectProfiles().filter((p) => p.dirName === dirName);
	if (matches.length === 0) return res.status(404).send("Profile not found");
	if (matches.length > 1)
		return res.status(400).send("Ambiguous profile; supply browser");
	const inferred = matches[0];
	const key = enabledKey(inferred.browser, dirName);
	if (enabledProfiles.has(key)) {
		enabledProfiles.delete(key);
		saveEnabledProfiles();
		return res.json({
			dirName,
			browser: inferred.browser,
			enabled: false,
			inferred: true,
		});
	}
	enabledProfiles.set(key, { browser: inferred.browser, dirName });
	saveEnabledProfiles();
	res.json({
		dirName,
		browser: inferred.browser,
		enabled: true,
		inferred: true,
	});
});

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
