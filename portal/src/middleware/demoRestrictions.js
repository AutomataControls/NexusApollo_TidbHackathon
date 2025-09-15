const jwt = require('jsonwebtoken');

// Middleware to check if user is Demo and restrict certain actions
function restrictDemoUser(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'apollo-nexus-secret-key');
    req.user = decoded;

    // Check if user is Demo
    if (decoded.username === 'Demo') {
      // Restrict certain methods and routes for Demo user
      const restrictedPaths = [
        '/api/equipment/control',
        '/api/relays',
        '/api/users',
        '/api/customers/delete',
        '/api/equipment/delete',
        '/api/settings/system'
      ];

      const restrictedMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];

      // Check if current path is restricted
      const isRestrictedPath = restrictedPaths.some(path => req.path.startsWith(path));

      // Check if method is restricted (except for specific allowed routes)
      const allowedDemoRoutes = [
        { path: '/api/vector-search/generate-demo', method: 'POST' },
        { path: '/api/auth/logout', method: 'POST' },
        { path: '/api/alarms/acknowledge', method: 'POST' },
        { path: '/api/alarms/acknowledge-all', method: 'POST' }
      ];

      // Also allow alarm acknowledge and resolve with ID pattern
      const isAlarmAction = (req.path.match(/^\/api\/alarms\/\d+\/(acknowledge|resolve)$/) && req.method === 'POST');

      const isAllowedRoute = allowedDemoRoutes.some(
        route => req.path === route.path && req.method === route.method
      ) || isAlarmAction;

      if (!isAllowedRoute && (isRestrictedPath || restrictedMethods.includes(req.method))) {
        return res.status(403).json({
          error: 'Demo user cannot perform this action',
          restricted: true
        });
      }
    }

    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// Middleware to check if user is Demo (for frontend awareness)
function isDemoUser(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'apollo-nexus-secret-key');
      req.user = decoded;
      req.isDemo = decoded.username === 'Demo';
    } catch (err) {
      // Continue without user info if token is invalid
    }
  }

  next();
}

module.exports = {
  restrictDemoUser,
  isDemoUser
};