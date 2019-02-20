const mongoose = require('../mongoose');

const channelSchema = new mongoose.Schema({
    token: String,
    refresh: String,
    expiration: Date,
    username: String,
    chatId: Number,
    state: String,
    groups: [Number],
    scheduleTime: { type: String, validate: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ }
})

module.exports = mongoose.model('Channel', channelSchema);