const TelegramBot = require('node-telegram-bot-api');

const config = require('./config');


const bot = new TelegramBot(config.telegram.token, { polling: true });

bot.onText(/\/start/, (msg, _) => {
    const chatId = msg.chat.id;
    const resp = 'Holà, je suis le happy botday, je suis là pour vous souhaiter vous rapeller les anniversaires de vos potes !\nPour commencer, il faut que quelqu\'un s\'identifie : /connect';
    bot.sendMessage(chatId, resp);
});

bot.onText(/\/connect/, (msg, _) => {
    const chatId = msg.chat.id;
    const resp = `Pour vous identifier, connectez-vous via l\'OAuth2 de ViaRézo depuis ce lien : ${config.website.protocol}://${config.website.hostname}/${chatId}`;
    bot.sendMessage(chatId, resp);
});