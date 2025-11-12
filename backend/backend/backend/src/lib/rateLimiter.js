class SimpleLimiter {
  constructor({windowMs=60000, max=60}={}) {
    this.windowMs = windowMs;
    this.max = max;
    this.buckets = new Map();
  }
  isAllowed(key){
    const now = Date.now();
    const rec = this.buckets.get(key) || {count:0, resetAt: now + this.windowMs};
    if (now > rec.resetAt) { rec.count = 0; rec.resetAt = now + this.windowMs; }
    rec.count++;
    this.buckets.set(key, rec);
    return rec.count <= this.max;
  }
}
module.exports = { SimpleLimiter };
