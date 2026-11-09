const { HttpError } = require('./errors');

const TIMEOUT_MS = 5000;

// Calls another microservice's internal API with the shared internal key.
// 2xx returns the response's `data`; 4xx is passed through to our caller; anything else is a 502.
function createServiceClient(baseUrl, internalApiKey, serviceLabel) {
  return async function callService(method, path, body) {
    let response;

    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { 'content-type': 'application/json', 'x-internal-key': internalApiKey },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
    } catch (err) {
      throw new HttpError(502, `${serviceLabel} is unreachable`);
    }

    const payload = await response.json().catch(() => {
      throw new HttpError(502, `${serviceLabel} returned an invalid response`);
    });

    if (response.ok) {
      return payload.data;
    }

    if (response.status >= 400 && response.status < 500) {
      throw new HttpError(response.status, payload.message);
    }

    throw new HttpError(502, `${serviceLabel} failed with status ${response.status}`);
  };
}

module.exports = { createServiceClient };
