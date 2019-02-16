const mongoose = require('../mongoose');

const channelSchema = new mongoose.Schema({
    token: String,
    expiration: Date,
    username: String,
    chatId: Number,
    state: String,
    groups: [{ id: Number, name: String }]
})

module.exports = mongoose.model('Channel', channelSchema);