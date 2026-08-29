// Suspicious-activity log sink. Console-based for now — wire to a real log
// aggregator before running more than one instance.
function securityLog(event, details) {
  console.warn(`[security] ${event}`, JSON.stringify(details));
}

module.exports = { securityLog };
