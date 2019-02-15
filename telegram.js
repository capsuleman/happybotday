process.env["NTBA_FIX_319"] = 1;
const TelegramBot = require('node-telegram-bot-api');
const Token = require('./models/Token');

const config = require('./config');


const bot = new TelegramBot(config.telegram.token, { polling: true });

bot.onText(/\/start/, (msg, _) => {
    console.log(msg);
    const chatId = msg.chat.id;
    const resp = 'Holà, je suis le Happy Botday, je suis là pour vous souhaiter vous rapeller les anniversaires de vos potes !\nPour commencer, il faut que quelqu\'un s\'identifie : /connect';
    bot.sendMessage(chatId, resp);
});

bot.onText(/\/connect/, (msg, _) => {
    const chatId = msg.chat.id;
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    Token.findOne({
        chatId: chatId
    }).then(token => {
        if (!token) {
            return Token.create({
                username: msg.from.username,
                chatId: chatId,
                state: state
            })
        } else if (!token.token) {
            return Token.findByIdAndDelete(token._id).then(_ => {
                return Token.create({
                    username: msg.from.username,
                    chatId: chatId,
                    state: state
                })
            })
        } else {
            bot.sendMessage(chatId, `Une connexion a déjà été faite par @${token.username}. Pour la réinitialiser, faites /disconnect`);
        }
    }).then(token => {
        if (!token) return
        const resp = `Pour vous identifier, connectez-vous via l\'OAuth2 de ViaRézo depuis ce lien :\n${config.website.protocol}://${config.website.hostname}/?state=${state}`;
        bot.sendMessage(chatId, resp);
    })
});

bot.onText(/\/disconnect/, (msg, _) => {
    const chatId = msg.chat.id;
    Token.findOneAndDelete({ chatId: chatId }).then(token => {
        if (!token) return bot.sendMessage(chatId, 'Pas de compte connecté');
        const resp = `@${token.username} n'est plus connecté à l'OAuth2.`;
        bot.sendMessage(chatId, resp);
    })
});

module.exports = bot;