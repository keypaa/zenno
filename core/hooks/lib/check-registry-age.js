const REGISTRY_URLS = {
  npm: (pkg) => `https://registry.npmjs.org/${encodeURIComponent(pkg)}`,
  yarn: (pkg) => `https://registry.npmjs.org/${encodeURIComponent(pkg)}`,
  pnpm: (pkg) => `https://registry.npmjs.org/${encodeURIComponent(pkg)}`,
  pip: (pkg) => `https://pypi.org/pypi/${encodeURIComponent(pkg)}/json`,
  cargo: (pkg) => `https://crates.io/api/v1/crates/${encodeURIComponent(pkg)}`,
};

const DEFAULT_TIMEOUT_MS = 3000;
// A package published within this window is treated as "very recently
// published" — a known pattern in real supply-chain attacks, where a
// malicious package is published shortly before being targeted at
// unsuspecting installs.
const RECENTLY_PUBLISHED_DAYS = 7;

function extractCreatedDate(ecosystem, body) {
  if (ecosystem === 'npm' || ecosystem === 'yarn' || ecosystem === 'pnpm') {
    const created = body?.time?.created;
    return created ? new Date(created) : null;
  }
  if (ecosystem === 'pip') {
    // PyPI's JSON API doesn't expose a single "created" field directly;
    // the earliest release upload_time across all versions is the closest
    // available signal for "when did this package first appear."
    const releases = body?.releases || {};
    const uploadTimes = Object.values(releases)
      .flat()
      .map((r) => r?.upload_time_iso_8601)
      .filter(Boolean)
      .map((t) => new Date(t));
    if (uploadTimes.length === 0) return null;
    return new Date(Math.min(...uploadTimes.map((d) => d.getTime())));
  }
  if (ecosystem === 'cargo') {
    const created = body?.crate?.created_at;
    return created ? new Date(created) : null;
  }
  return null;
}

async function checkRegistryAge(packageName, ecosystem, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const urlBuilder = REGISTRY_URLS[ecosystem];
  if (!urlBuilder) {
    return { checked: false, reason: 'unsupported-ecosystem', createdAt: null, veryRecent: false };
  }

  try {
    const response = await fetch(urlBuilder(packageName), {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'zenno-provenance-guard' }, // crates.io requires a real UA or it rejects the request
    });

    if (response.status === 404) {
      return { checked: true, reason: 'not-found', createdAt: null, veryRecent: false };
    }
    if (!response.ok) {
      return { checked: false, reason: `http-${response.status}`, createdAt: null, veryRecent: false };
    }

    const body = await response.json();
    const createdAt = extractCreatedDate(ecosystem, body);
    if (!createdAt) {
      return { checked: true, reason: 'no-date-available', createdAt: null, veryRecent: false };
    }

    const ageDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    return {
      checked: true,
      reason: 'ok',
      createdAt: createdAt.toISOString(),
      veryRecent: ageDays <= RECENTLY_PUBLISHED_DAYS,
    };
  } catch (err) {
    // Timeout or network failure — fall back gracefully rather than
    // blocking the install on a registry hiccup. The caller (the hook)
    // still has the local-list typosquat check and manifest check as
    // signals that don't depend on network access.
    return { checked: false, reason: 'timeout-or-network-error', createdAt: null, veryRecent: false };
  }
}

module.exports = { checkRegistryAge, RECENTLY_PUBLISHED_DAYS, DEFAULT_TIMEOUT_MS };
