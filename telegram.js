process.env["NTBA_FIX_319"] = 1;
const TelegramBot = require('node-telegram-bot-api');
const Channel = require('./models/Channel');

const config = require('./config');
const { getBirthdays, searchGroups, getGroupById } = require('./requests');


const bot = new TelegramBot(config.telegram.token, { polling: true });


// A la connexion, création d'un document Channel dans MongoDB
bot.onText(/\/start/, msg => {
    const chatId = msg.chat.id;
    return Channel.findOne({
        chatId: chatId
    }).then(chan => {
        // /start déjà fait...
        if (chan) return bot.sendMessage(chatId, 'Vous avez déjà fait lancé le bot sur cette conversation. Pour tout réinitialiser, faites /reset.')
        return Channel.create({
            chatId: chatId,
            username: '',
            state: '',
            token: '',
            groups: []
        }).then(_ => {
            const resp = 'Holà, je suis le Happy Botday, je suis là pour vous souhaiter vous rapeller les anniversaires de vos potes !\nPour commencer, il faut que quelqu\'un s\'identifie : /connect';
            bot.sendMessage(chatId, resp);
        })
    })
});

// Suppression de l'objet créé lors du /start
bot.onText(/\/reset/, msg => {
    const chatId = msg.chat.id;
    // Suppression de l'objet
    return Channel.findOneAndDelete({
        chatId: chatId
    }).then(_ => {
        const resp = 'Toutes vos paramètres ont été supprimés. Pour recommencer à m\'utiliser, faites /start.';
        return bot.sendMessage(chatId, resp);
    })
})


// Si rien n'a été fait avant, propose un lien de connexion à l'OAuth2 de VR
bot.onText(/\/connect/, (msg, _) => {
    const chatId = msg.chat.id;
    Channel.findOne({
        chatId: chatId
    }).then(chan => {
        // start pas encore fait
        if (!chan) return bot.sendMessage(chatId, 'Avant de vous authentifier, faites /start.');
        // /connect déjà fait, renvoie vers le lien précédent
        if (chan.state.length !== 0) return bot.sendMessage(chatId, `@${chan.username} a déjà fait une demande. Vous pouvez annuler la demande via /cancel ou @${chan.username} peut se connecter depuis ce lien :\n${config.website.protocol}://${config.website.hostname}/?state=${chan.state}.`)
        // authentification déjà faite
        if (chan.token.length !== 0) return bot.sendMessage(chatId, `Une connexion a déjà été faite par @${chan.username}. Pour la réinitialiser, faites /disconnect`);
        // dans le reste des cas, création d'un lien pour l'authentification et enregistrement dans l'objet pour être sur
        chan.state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        chan.username = msg.from.username;
        chan.save().then(chan => {
            const resp = `Pour vous identifier, connectez-vous via l\'OAuth2 de ViaRézo depuis ce lien :\n${config.website.protocol}://${config.website.hostname}/?state=${chan.state}`;
            return bot.sendMessage(chatId, resp);
        })
    })
});

// Annulation de la demande de connexion
bot.onText(/\/cancel/, msg => {
    const chatId = msg.chat.id;
    Channel.findOne({
        chatId: chatId
    }).then(chan => {
        // ne peut pas annuler une demande déjà acceptée
        if (chan.token.length !== 0) return bot.sendMessage(chatId, 'La demande d\'athentification a déjà été acceptée, elle ne peut pas être annulée. Pour se déconnecter, faites /disconnect.')
        chan.username = '';
        chan.state = '';
        return chan.save().then(chan => {
            return bot.sendMessage(chatId, 'La demande d\'authentification a été annulée. Vous pouvez vous reconnecter avec /connect.')
        })
    })
})

// Permet de déconnecter l'utilisateur qui s'est authentifié sur l'OAuth2
bot.onText(/\/disconnect/, msg => {
    const chatId = msg.chat.id;
    Channel.findOne({ chatId: chatId }).then(chan => {
        // s'il n'y a pas de token, personne ne s'est connecté
        if (chan.token.length === 0) return bot.sendMessage(chatId, 'Personne ne s\'est connecté...');
        // suppression de tous les paramètres de connexion et save()
        username = chan.username;
        chan.token = '';
        chan.expiration = Date.now(0);
        chan.username = '';
        chan.save().then(_ => {
            return bot.sendMessage(chatId, `@${username} n'est plus connecté à l'OAuth2.`);
        })
    })
});

// Affiche tous les anniversaires de LinkCS
bot.onText(/\/allbirthdays/, msg => {
    const chatId = msg.chat.id;
    // recherche du token du chan actuel
    Channel.findOne({
        chatId: chatId,
    }).then(chan => {
        return getBirthdays(chan.token)
    }).then(users => {
        var msg = '**Joyeux anniversaire** à :\n'
        users.forEach(user => {
            msg += `${user.name}\n`
        });
        return bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
    })
});

// Affiche les anniversaires demandés
bot.onText(/\/birthdays/, msg => {
    const chatId = msg.chat.id;
    // recherche du token du chan actuel
    Channel.findOne({
        chatId: chatId,
    }).then(chan => {
        return Promise.all([getBirthdays(chan.token), chan])
    }).then(([users, chan]) => {
        // récupère que les personnes du jour qui font partie des groupes ciblés
        const newUsers = users.filter(user => user.asso.some(asso => chan.groups.indexOf(asso) !== -1));
        if (newUsers.length === 0) return bot.sendMessage(chatId, 'Pas d\'anniversaire à souhaiter aujourd\'hui.')
        var msg = '**Joyeux anniversaire** à :\n'
        newUsers.forEach(user => {
            msg += `${user.name}\n`
        });
        return bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
    })
});

// recherche des groupes et renvoie le résultat avec leurs ID pour les rajouter
bot.onText(/\/search (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const research = match[1];
    Channel.findOne({
        chatId: chatId
    }).then(chan => {
        return searchGroups(chan.token, research)
    }).then(groups => {
        if (groups.length == 0) return bot.sendMessage(chatId, 'Pas de groupe à ce nom...');
        var resp = 'Voici les différentes associations. Faites /add XXXX pour ajouter les anniversaires de ses membres. ';
        // LinkCS limite à 20 résultats
        if (groups.length == 20) resp += 'La recherche est limitée à 20 choix.'
        resp += '\n\n'
        groups.forEach(group => {
            resp += `${group.name} : \`/add ${group.id}\`\nhttps://linkcs.fr/association/${group.code} \n\n`
        })
        bot.sendMessage(chatId, resp, { parse_mode: 'Markdown' });
    });
})

// J'étais bien obligé
bot.onText(/\/nikmarine/, msg => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Nik bien Marine');
})

// Ajout d'un groupe dans la liste des groupes
bot.onText(/\/add (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    Channel.findOne({
        chatId: chatId
    }).then(chan => {
        var id = parseInt(match[1].split(' ')[0]);
        return Promise.all([getGroupById(chan.token, id), chan, id]);
    }).then(([group, chan, id]) => {
        // si pas de groupe trouvé
        if (!group) return bot.sendMessage(chatId, 'Pas de groupe trouvé ayant cette ID');
        // si le groupe y est déjà
        if (chan.groups.indexOf(id) !== -1) return bot.sendMessage(chatId, 'Ce groupe est déjà est dans votre liste d\'anniversaire.');
        // sinon on le rajoute
        chan.groups.push(id);
        return chan.save().then(_ => {
            bot.sendMessage(chatId, `Ajout du groupe \`${group}\` à la liste des anniversaires.`, { parse_mode: 'Markdown' });
        })
    })
})

module.exports = bot;