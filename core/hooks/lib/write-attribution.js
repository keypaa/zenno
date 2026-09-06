const fs = require('node:fs');
const path = require('node:path');

function writeAttributionDefault(homeDir) {
  const claudeDir = path.join(homeDir, '.claude');
  const settingsPath = path.join(claudeDir, 'settings.json');

  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }

  let settings = {};
  if (fs.existsSync(settingsPath)) {
    const raw = fs.readFileSync(settingsPath, 'utf8').trim();
    settings = raw.length > 0 ? JSON.parse(raw) : {};
  }

  // Only set the default when the attribution key is entirely absent.
  // Any existing value — even one that doesn't match our default — may be
  // a deliberate user choice (e.g. they turned co-authorship back on for
  // this machine) and must never be silently overwritten by a bootstrap
  // re-run, which can genuinely happen if the .initialized marker is lost.
  if (Object.prototype.hasOwnProperty.call(settings, 'attribution')) {
    return { path: settingsPath, updated: false };
  }

  settings.attribution = { commit: '', pr: '' };
  fs.writeFileSync(
    settingsPath,
    JSON.stringify(settings, null, 2) + '\n',
    'utf8'
  );
  return { path: settingsPath, updated: true };
}

module.exports = { writeAttributionDefault };
