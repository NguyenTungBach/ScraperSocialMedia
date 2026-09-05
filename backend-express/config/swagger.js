require('dotenv').config();
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');

// Load OpenAPI YAML files (including split files)
const loadOpenApiFiles = () => {
    const openApiDir = path.join(__dirname, '../docs/openapi');
    const openApiPath = path.join(openApiDir, 'openapi.yaml');

    if (!fs.existsSync(openApiPath)) {
        return null;
    }

    try {
        let mainDoc = yaml.load(fs.readFileSync(openApiPath, 'utf8'));

        if (!mainDoc) {
            return null;
        }

        // Paths: JSDoc `@openapi` trong controllers/routes (swagger-jsdoc).

        const componentsDir = path.join(openApiDir, 'components');
        if (fs.existsSync(componentsDir)) {
            const componentFiles = fs.readdirSync(componentsDir).filter(f => f.endsWith('.yaml'));
            const components = mainDoc.components || {};

            componentFiles.forEach(file => {
                try {
                    const filePath = path.join(componentsDir, file);
                    const componentDoc = yaml.load(fs.readFileSync(filePath, 'utf8'));

                    if (componentDoc) {
                        if (file === 'schemas.yaml' && componentDoc.schemas) {
                            components.schemas = componentDoc.schemas;
                        } else if (file === 'responses.yaml' && componentDoc.responses) {
                            components.responses = componentDoc.responses;
                        } else if (file === 'security.yaml' && componentDoc.securitySchemes) {
                            components.securitySchemes = componentDoc.securitySchemes;
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to load component file ${file}:`, error.message);
                }
            });

            if (Object.keys(components).length > 0) {
                mainDoc.components = components;
            }
        }

        return mainDoc;
    } catch (error) {
        console.warn('Failed to load OpenAPI YAML:', error.message);
        return null;
    }
};

const openApiDefinition = loadOpenApiFiles();

const defaultDefinition = {
    openapi: '3.0.3',
    info: {
        title: 'ScraperSocialMedia API',
        version: '1.0.0',
        description:
            'ScraperSocialMedia Backend API — scrape async (FB/TikTok Apify, YouTube Data API), subjects/channels, social_posts, comments+Gemini, snapshots, alerts, settings, schedules, users',
        contact: {
            name: 'ScraperSocialMedia'
        },
        license: {
            name: 'MIT'
        }
    },
    servers: [
        {
            url: process.env.APP_URL ? `${process.env.APP_URL}/api` : 'http://localhost:3400/api',
            description: process.env.NODE_ENV || 'development'
        }
    ]
};

const mergeDeep = (target, source) => {
    const output = { ...target };
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = mergeDeep(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
};

const isObject = (item) => {
    return item && typeof item === 'object' && !Array.isArray(item);
};

const mergedDefinition = openApiDefinition
    ? mergeDeep(defaultDefinition, openApiDefinition)
    : defaultDefinition;

module.exports = {
    definition: mergedDefinition,
    apis: ['./routes/api/*.js', './app/Http/Controllers/**/*.js']
};
