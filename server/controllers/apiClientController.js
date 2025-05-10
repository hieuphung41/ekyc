import APIClient from '../models/APIClient.js';
import { generateToken } from '../utils/jwt.js';

// @desc    Register new API client
// @route   POST /api/clients/register
// @access  Private/Admin
export const registerClient = async (req, res) => {
    try {
        const {
            name,
            organization,
            contactPerson,
            permissions,
            ipWhitelist,
            rateLimits,
            webhookUrl
        } = req.body;

        const client = await APIClient.create({
            name,
            organization,
            contactPerson,
            permissions,
            ipWhitelist,
            rateLimits,
            webhookUrl
        });

        res.status(201).json({
            success: true,
            data: {
                id: client._id,
                name: client.name,
                clientId: client.clientId,
                clientSecret: client.clientSecret,
                apiKey: client.apiKey,
                permissions: client.permissions,
                status: client.status
            }
        });
    } catch (error) {
        console.error('API client registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Error registering API client'
        });
    }
};

// @desc    Get API client details
// @route   GET /api/clients/:id
// @access  Private/Admin
export const getClient = async (req, res) => {
    try {
        const client = await APIClient.findById(req.params.id);
        if (!client) {
            return res.status(404).json({
                success: false,
                message: 'API client not found'
            });
        }

        res.json({
            success: true,
            data: client
        });
    } catch (error) {
        console.error('Get API client error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching API client details'
        });
    }
};

// @desc    Update API client
// @route   PUT /api/clients/:id
// @access  Private/Admin
export const updateClient = async (req, res) => {
    try {
        const {
            name,
            organization,
            contactPerson,
            permissions,
            ipWhitelist,
            rateLimits,
            webhookUrl,
            status
        } = req.body;

        const client = await APIClient.findById(req.params.id);
        if (!client) {
            return res.status(404).json({
                success: false,
                message: 'API client not found'
            });
        }

        // Update fields
        if (name) client.name = name;
        if (organization) client.organization = organization;
        if (contactPerson) client.contactPerson = contactPerson;
        if (permissions) client.permissions = permissions;
        if (ipWhitelist) client.ipWhitelist = ipWhitelist;
        if (rateLimits) client.rateLimits = rateLimits;
        if (webhookUrl) client.webhookUrl = webhookUrl;
        if (status) client.status = status;

        await client.save();

        res.json({
            success: true,
            data: client
        });
    } catch (error) {
        console.error('Update API client error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating API client'
        });
    }
};

// @desc    Generate new API key
// @route   POST /api/clients/:id/generate-key
// @access  Private/Admin
export const generateApiKey = async (req, res) => {
    try {
        const client = await APIClient.findById(req.params.id);
        if (!client) {
            return res.status(404).json({
                success: false,
                message: 'API client not found'
            });
        }

        const newApiKey = client.generateNewApiKey();
        await client.save();

        res.json({
            success: true,
            data: {
                apiKey: newApiKey
            }
        });
    } catch (error) {
        console.error('Generate API key error:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating new API key'
        });
    }
};

// @desc    Get all API clients
// @route   GET /api/clients
// @access  Private/Admin
export const getAllClients = async (req, res) => {
    try {
        const clients = await APIClient.find()
            .select('-clientSecret')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: clients
        });
    } catch (error) {
        console.error('Get all API clients error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching API clients'
        });
    }
};

// @desc    Authenticate API client
// @route   POST /api/clients/auth
// @access  Public
export const authenticateClient = async (req, res) => {
    try {
        const { clientId, clientSecret } = req.body;

        const client = await APIClient.findOne({ clientId });
        if (!client || !client.validateCredentials(clientId, clientSecret)) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        if (client.status !== 'active') {
            return res.status(403).json({
                success: false,
                message: 'API client is not active'
            });
        }

        // Generate token
        const token = generateToken({
            id: client._id,
            role: 'api-client',
            permissions: client.permissions
        });

        res.json({
            success: true,
            data: {
                token,
                permissions: client.permissions
            }
        });
    } catch (error) {
        console.error('API client authentication error:', error);
        res.status(500).json({
            success: false,
            message: 'Error authenticating API client'
        });
    }
}; 