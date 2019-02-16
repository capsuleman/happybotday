process.env["NTBA_FIX_319"] = 1;
const TelegramBot = require('node-telegram-bot-api');
const Channel = require('./models/Channel');

const config = require('./config');
const { getBirthdays, searchGroups, getGroupById } = require('./requests');


const bot = new TelegramBot(config.telegram.token, { polling: true });

bot.onText(/\/start/, (msg, _) => {
    const chatId = msg.chat.id;
    const resp = 'Holà, je suis le Happy Botday, je suis là pour vous souhaiter vous rapeller les anniversaires de vos potes !\nPour commencer, il faut que quelqu\'un s\'identifie : /connect';
    bot.sendMessage(chatId, resp);
});

bot.onText(/\/connect/, (msg, _) => {
    const chatId = msg.chat.id;
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    Channel.findOne({
        chatId: chatId
    }).then(chan => {
        if (!chan) {
            return Channel.create({
                username: msg.from.username,
                chatId: chatId,
                state: state,
                groups: []
            })
        } else if (!chan.token) {
            return Channel.findByIdAndDelete(chan._id).then(_ => {
                return Channel.create({
                    username: msg.from.username,
                    chatId: chatId,
                    state: state
                })
            })
        } else {
            bot.sendMessage(chatId, `Une connexion a déjà été faite par @${chan.username}. Pour la réinitialiser, faites /disconnect`);
        }
    }).then(chan => {
        if (!chan) return
        const resp = `Pour vous identifier, connectez-vous via l\'OAuth2 de ViaRézo depuis ce lien :\n${config.website.protocol}://${config.website.hostname}/?state=${state}`;
        bot.sendMessage(chatId, resp);
    })
});

bot.onText(/\/disconnect/, (msg, _) => {
    const chatId = msg.chat.id;
    Channel.findOneAndDelete({ chatId: chatId }).then(chan => {
        console.log(msg);
        if (!chan) return bot.sendMessage(chatId, 'Pas de compte connecté');
        const resp = `@${chan.username} n'est plus connecté à l'OAuth2.`;
        bot.sendMessage(chatId, resp);
    })
});

bot.onText(/\/birthdays/, (msg, _) => {
    const chatId = msg.chat.id;
    Channel.findOne({
        chatId: chatId,
        expiration: { $gt: Date.now() }
    }).then(chan => {
        return getBirthdays(chan.token)
    }).then(users => {
        var msg = 'Joyeux anniversaire à :\n'
        users.forEach(user => {
            msg += `${user.name}\n`
        });
        bot.sendMessage(chatId, msg);
    })
});

bot.onText(/\/search (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const research = match[1];
    Channel.findOne({
        chatId: chatId,
        expiration: { $gt: Date.now() }
    }).then(chan => {
        return searchGroups(chan.token, research)
    }).then(groups => {
        if (groups.length == 0) return bot.sendMessage(chatId, 'Pas de groupe à ce nom...');
        var resp = 'Voici les différentes associations. Faites /add XXXX pour ajouter les anniversaires de ses membres. ';
        if (groups.length == 20) resp += 'La recherche est limitée à 20 choix.'
        resp += '\n\n'
        groups.forEach(group => {
            resp += `${group.name} : \`/add ${group.id}\`\nhttps://linkcs.fr/association/${group.code} \n\n`
        })
        bot.sendMessage(chatId, resp, { parse_mode: 'Markdown' });
    });
})

bot.onText(/\/nikmarine/, (msg, _) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Nik bien Marine');
})

bot.onText(/\/add (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    Channel.findOne({
        chatId: chatId,
        expiration: { $gt: Date.now() }
    }).then(chan => {
        var id = parseInt(match[1].split(' ')[0]);
        return Promise.all([getGroupById(chan.token, id), chan, id]);
    }).then(([group, chan, id]) => {
        if (!group) return bot.sendMessage(chatId, 'Pas de groupe trouvé ayant cette ID');
        ids = chan.groups.map(g => g.id);
        if (id in ids) return bot.sendMessage(chatId, 'Ce groupe est déjà est dans votre liste d\'anniversaire.');
        console.log(chan.groups);
        chan.groups.push({ id: id, name: group });
        console.log(chan.groups);
        return chan.save().then(_ => {
            bot.sendMessage(chatId, `Ajout du groupe \`${group}\` à la liste des anniversaires.`, { parse_mode: 'Markdown' });
        })
    })
})

module.exports = bot;