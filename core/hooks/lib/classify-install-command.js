// Extracts, for a Bash command, which package-manager install it is (if
// any), which package names are being installed, and whether it's a
// global/system-wide install. Deliberately narrow scope (npm/yarn/pnpm/
// pip/cargo) rather than every possible package manager — extensible list,
// not exhaustive, matching the design spec's "extensible list" framing.
const GLOBAL_FLAGS = new Set(['-g', '--global', '--user']);

// Flags that consume the NEXT token as their own argument, rather than
// that token being a package name. Without this, "pip install -r
// requirements.txt" misclassified "requirements.txt" itself as a package
// being installed — wasting a registry lookup and, worse, writing a
// factually-wrong "new dependency" entry to the audit journal.
const ARG_CONSUMING_FLAGS = new Set(['-r', '--requirement', '-c', '--constraint']);

function stripFlags(tokens) {
  const result = [];
  let skipNext = false;
  for (const token of tokens) {
    if (skipNext) {
      skipNext = false;
      continue;
    }
    if (ARG_CONSUMING_FLAGS.has(token)) {
      skipNext = true;
      continue;
    }
    if (token.startsWith('-')) continue;
    result.push(token);
  }
  return result;
}

function classifyInstallCommand(command) {
  const tokens = command.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;

  const [cmd, sub, ...rest] = tokens;

  if (cmd === 'npm' && (sub === 'install' || sub === 'i')) {
    return {
      ecosystem: 'npm',
      packages: stripFlags(rest),
      isGlobal: rest.some((t) => GLOBAL_FLAGS.has(t)),
    };
  }
  if ((cmd === 'yarn' && sub === 'add') || (cmd === 'pnpm' && sub === 'add')) {
    return {
      ecosystem: cmd,
      packages: stripFlags(rest),
      isGlobal: rest.some((t) => GLOBAL_FLAGS.has(t) || t === '-g' || t === '--global'),
    };
  }
  if ((cmd === 'pip' || cmd === 'pip3') && sub === 'install') {
    return {
      ecosystem: 'pip',
      packages: stripFlags(rest),
      isGlobal: rest.includes('--user'), // pip has no true "-g"; --user is the closest analog
    };
  }
  if (cmd === 'cargo' && sub === 'add') {
    return { ecosystem: 'cargo', packages: stripFlags(rest), isGlobal: false };
  }
  if (cmd === 'cargo' && sub === 'install') {
    // cargo install always installs a system-wide binary via ~/.cargo/bin —
    // there is no project-scoped variant of this subcommand, unlike
    // "cargo add" which modifies Cargo.toml. Always global by definition.
    return { ecosystem: 'cargo', packages: stripFlags(rest), isGlobal: true };
  }

  return null;
}

module.exports = { classifyInstallCommand };
