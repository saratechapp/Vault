// Coarse device label from a User-Agent string — backs login_events.device,
// which in turn backs the admin panel's Devices tab and Device Distribution
// chart. Shared by the consumer /api/login-events route (server.js) and the
// admin panel's user list (routes/admin/users.js) so both agree on the same
// small set of labels.
function parseDevice(userAgent) {
  if (!userAgent) return 'Unknown';
  const ua = userAgent.toLowerCase();
  if (ua.includes('ipad')) return 'iPad';
  if (ua.includes('iphone')) return 'iPhone';
  if (ua.includes('android')) return ua.includes('mobile') ? 'Android Phone' : 'Android Tablet';
  if (ua.includes('macintosh')) return 'Mac';
  if (ua.includes('windows')) return 'Windows PC';
  if (ua.includes('linux')) return 'Linux';
  return 'Other';
}

module.exports = { parseDevice };
