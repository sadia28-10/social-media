// Every successful response uses the same shape: { success: true, data }.
const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

module.exports = { ok };
