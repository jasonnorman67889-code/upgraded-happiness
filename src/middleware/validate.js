const { z } = require('zod');

const entitySchema = z.object({
  type: z.string(),
  address: z.string().optional(),
  actorId: z.string().optional()
}).passthrough();

const incidentSchema = z.object({
  incidentId: z.string().min(1),
  entities: z.array(entitySchema)
}).passthrough();

function validateIncident(req, res, next) {
  const result = incidentSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      error: 'invalid_payload',
      details: result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message
      }))
    });
    return;
  }

  req.body = result.data;
  next();
}

module.exports = { validateIncident };
