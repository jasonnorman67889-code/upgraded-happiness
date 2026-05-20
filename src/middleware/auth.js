const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { config } = require('../config');

const jwks = config.jwksUri
  ? jwksClient({
      jwksUri: config.jwksUri,
      cache: true,
      cacheMaxEntries: 10,
      cacheMaxAge: 600000,
      rateLimit: true,
      jwksRequestsPerMinute: 10
    })
  : null;

function getKey(header, callback) {
  if (!jwks || !header.kid) {
    callback(new Error('missing_jwks_or_kid'));
    return;
  }

  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }

    callback(null, key.getPublicKey());
  });
}

function verifyToken(token) {
  return new Promise((resolve, reject) => {
    const baseOptions = {
      issuer: config.jwtIssuer || undefined,
      audience: config.jwtAudience || undefined
    };

    if (config.jwtMode === 'hs256') {
      jwt.verify(token, config.jwtSecret, { ...baseOptions, algorithms: ['HS256'] }, (err, decoded) => {
        if (err) return reject(err);
        return resolve(decoded);
      });
      return;
    }

    if (config.jwtMode === 'jwks') {
      jwt.verify(token, getKey, { ...baseOptions, algorithms: ['RS256'] }, (err, decoded) => {
        if (err) return reject(err);
        return resolve(decoded);
      });
      return;
    }

    reject(new Error('jwt_disabled'));
  });
}

async function validateJwt(req, res, next) {
  if (config.jwtMode === 'disabled') {
    next();
    return;
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'missing_token' });
    return;
  }

  try {
    req.identity = await verifyToken(token);
    next();
  } catch (_err) {
    res.status(401).json({ error: 'invalid_token' });
  }
}

module.exports = { validateJwt, verifyToken };
