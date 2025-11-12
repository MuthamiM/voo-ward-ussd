const { z } = require('zod');
const UssdBodySchema = z.object({
  sessionId: z.string().min(1),
  phoneNumber: z.string().regex(/^\+?[0-9]{10,13}$/)
});
module.exports = { UssdBodySchema };
