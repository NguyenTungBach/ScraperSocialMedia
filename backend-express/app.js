const express = require('express');
const path = require('path');
require('express-async-errors');
require('dotenv').config();

const app = express();

app.use('/storage', express.static(path.join(__dirname, 'public', 'storage')));

// CORS configuration
const cors = require('./app/Http/Middleware/Cors');
app.use(cors);

// Basic middleware — giữ rawBody để verify Slack signing secret
const captureRawBody = (req, _res, buf) => {
  if (buf?.length) {
    req.rawBody = buf;
  }
};
app.use(express.json({ verify: captureRawBody }));
app.use(express.urlencoded({ extended: true, verify: captureRawBody }));

// Request logging
const requestLogging = require('./app/Http/Middleware/RequestLogging');
app.use(requestLogging);

// Rate limiting (optional)
// const rateLimiter = require('./app/Http/Middleware/RateLimiter');
// app.use(rateLimiter(100, 60000)); // Up to 100 requests per minute

// Swagger configuration
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const swaggerConfig = require('./config/swagger');

const swaggerSpec = swaggerJsdoc(swaggerConfig);

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'ScraperSocialMedia API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
    supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
    validatorUrl: null,
    url: '/api-docs.json',
    urls: [
      {
        url: '/api-docs.json',
        name: 'ScraperSocialMedia API'
      }
    ]
  },
  customCssUrl: null,
  customfavIcon: null,
  customSiteTitle: 'ScraperSocialMedia API Documentation'
}));

// OpenAPI specification JSON endpoint
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Routing — một entry `/api` khớp Laravel `Route::prefix('api')`
const apiRoutes = require('./routes/api/index');
app.use('/api', apiRoutes);

// Error handling (place at the end)
const ExceptionHandler = require('./app/Exceptions/Handler');
app.use((err, req, res, next) => {
  ExceptionHandler.handle(err, req, res, next);
});

module.exports = app;
