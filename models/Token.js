const mongoose = require('../mongoose');

const tokenSchema = new mongoose.Schema({
    token: String,
    expiration: Date,
    username: String,
    chatId: Number,
    state: String
})

module.exports = mongoose.model('Token', tokenSchema);