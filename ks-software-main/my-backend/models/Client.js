// Filename: models/Client.js

const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        unique: true,
        trim: true,
        lowercase: true
    },
    businessName: {
        type: String,
        trim: true
    },
    businessAddress: {
        type: String,
        trim: true
    },
    businessPhone: {
        type: String,
        trim: true
    },
    socialMedia: {
        facebook: {
            id: { type: String, trim: true },
            password: { type: String, trim: true }
        },
        instagram: {
            id: { type: String, trim: true },
            password: { type: String, trim: true }
        }
    },
    teamMembers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Client = mongoose.model('Client', clientSchema);

module.exports = Client;
