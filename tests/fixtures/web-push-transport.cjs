// Loaded only by the owned browser-test server, never by a deployed app.
// Keep the real subscription validation/DB persistence; replace just delivery.
const push = require('web-push');
push.sendNotification = async subscription => {
  if (subscription?.endpoint !== 'https://web.push.apple.com/synthetic-browser-test') {
    throw new Error('External push delivery is disabled in the synthetic browser runner');
  }
  return { statusCode: 201, body: 'synthetic-local-only', headers: {} };
};
