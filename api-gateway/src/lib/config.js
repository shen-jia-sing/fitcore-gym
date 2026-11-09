// Reads required environment variables. A missing value stops the service at startup.
function requireEnv(name) {
  const value = process.env[name];

  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function requireIntEnv(name) {
  const value = Number(requireEnv(name));

  if (!Number.isInteger(value)) {
    throw new Error(`Environment variable ${name} must be an integer`);
  }

  return value;
}

module.exports = { requireEnv, requireIntEnv };
