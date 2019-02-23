process.env["NTBA_FIX_319"] = 1;

// Modules extérieurs
var TelegramBot = require('node-telegram-bot-api');

// Modules propres
var { getChanByChatId, createChan, deleteChanByChatId, modifyChan, addGroup, removeGroup, getGroups } = require('./connection-db');
var { getBirthdays, searchGroups, getGroupById } = require('./requests');
var { schedules, addSchedule, deleteSchedule } = require('./schedule');

// Configurations
const config = require('./config');

// Création de variables
var bot = new TelegramBot(config.telegram.token, { polling: true });



// A la connexion, création d'un document Channel dans MongoDB
bot.onText(/\/start/, msg => {
    const chatId = msg.chat.id;
    return getChanByChatId(chatId).then(chan => {
        // /start déjà fait...
        if (chan) return bot.sendMessage(chatId, 'Vous avez déjà fait lancé le bot sur cette conversation. Pour tout réinitialiser, faites /reset.')
        return createChan(chatId).then(_ => {
            const resp = 'Holà, je suis le Happy Botday, je suis là pour vous souhaiter vous rapeller les anniversaires de vos potes !\nPour commencer, il faut que quelqu\'un s\'identifie : /connect';
            bot.sendMessage(chatId, resp);
        })
    })
});

// Suppression de l'objet créé lors du /start
bot.onText(/\/reset/, msg => {
    const chatId = msg.chat.id;
    // Suppression de l'objet
    deleteSchedule(chatId);
    return Promise.all([
        deleteChanByChatId(chatId),
    ]).then(_ => {
        const resp = 'Toutes vos paramètres ont été supprimés. Pour recommencer à m\'utiliser, faites /start.';
        bot.sendMessage(chatId, resp);
    })
})


// Si rien n'a été fait avant, propose un lien de connexion à l'OAuth2 de VR
bot.onText(/\/connect/, (msg, _) => {
    const chatId = msg.chat.id;
    getChanByChatId(chatId).then(chan => {
        // start pas encore fait
        if (!chan) return bot.sendMessage(chatId, 'Avant de vous authentifier, faites /start.');
        // /connect déjà fait, renvoie vers le lien précédent
        if (chan.state.length !== 0) return bot.sendMessage(chatId, `@${chan.username} a déjà fait une demande. Vous pouvez annuler la demande via /cancel ou @${chan.username} peut se connecter depuis ce lien :\n${config.website.protocol}://${config.website.hostname}/?state=${chan.state}`)
        // authentification déjà faite
        if (chan.token.length !== 0) return bot.sendMessage(chatId, `Une connexion a déjà été faite par @${chan.username}. Pour la réinitialiser, faites /disconnect`);
        // dans le reste des cas, création d'un lien pour l'authentification et enregistrement dans l'objet pour être sur
        chan.state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        chan.username = msg.from.username;
        modifyChan(chan).then(chan => {
            const resp = `Pour vous identifier, connectez-vous via l\'OAuth2 de ViaRézo depuis ce lien :\n${config.website.protocol}://${config.website.hostname}/?state=${chan.state}`;
            return bot.sendMessage(chatId, resp);
        })
    })
});

// Annulation de la demande de connexion
bot.onText(/\/cancel/, msg => {
    const chatId = msg.chat.id;
    getChanByChatId(chatId).then(chan => {
        // ne peut pas annuler une demande déjà acceptée
        if (chan.token.length !== 0) return bot.sendMessage(chatId, 'La demande d\'athentification a déjà été acceptée, elle ne peut pas être annulée. Pour se déconnecter, faites /disconnect.')
        chan.username = '';
        chan.state = '';
        modifyChan(chan).then(_ => bot.sendMessage(chatId, 'La demande d\'authentification a été annulée. Vous pouvez vous reconnecter avec /connect.'))
    })
})

// Permet de déconnecter l'utilisateur qui s'est authentifié sur l'OAuth2
bot.onText(/\/disconnect/, msg => {
    const chatId = msg.chat.id;
    getChanByChatId(chatId).then(chan => {
        // s'il n'y a pas de token, personne ne s'est connecté
        if (chan.token.length === 0) return bot.sendMessage(chatId, 'Personne ne s\'est connecté...');
        // suppression de tous les paramètres de connexion et save()
        username = chan.username;
        chan.token = '';
        chan.expiration = Date.now(0);
        chan.username = '';
        modifyChan(chan).then(_ => bot.sendMessage(chatId, `@${username} n'est plus connecté à l'OAuth2.`));
    })
});

// Affiche tous les anniversaires de LinkCS
bot.onText(/\/allbirthdays/, msg => {
    const chatId = msg.chat.id;
    // recherche du token du chan actuel
    getChanByChatId(chatId).then(chan => {
        return getBirthdays(chan.token)
    }).then(users => {
        var msg = '**Joyeux anniversaire** à :\n'
        users.forEach(user => {
            msg += `${user.name}\n`
        });
        bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
    })
});

// Affiche les anniversaires demandés
bot.onText(/\/birthdays/, msg => {
    const chatId = msg.chat.id;
    // recherche du token du chan actuel
    getChanByChatId(chatId).then(chan => {
        return Promise.all([
            getBirthdays(chan.token),
            getGroups(chatId),
        ])
    }).then(([users, groups]) => {
        // récupère que les personnes du jour qui font partie des groupes ciblés
        const newUsers = users.filter(user => user.asso.some(asso => groups.indexOf(asso) !== -1));
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
    getChanByChatId(chatId).then(chan => {
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

// Ajout d'un groupe dans la liste des groupes
bot.onText(/\/add (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    getChanByChatId(chatId).then(chan => {
        const id = parseInt(match[1].split(' ')[0]);
        return Promise.all([
            getGroupById(chan.token, id),
            getGroups(chatId),
            id
        ]);
    }).then(([group, groups, id]) => {
        // si pas de groupe trouvé
        if (!group) return bot.sendMessage(chatId, 'Pas de groupe trouvé ayant cette ID');
        // si le groupe y est déjà
        if (groups.indexOf(id) !== -1) return bot.sendMessage(chatId, 'Ce groupe est déjà est dans votre liste d\'anniversaire.');
        // sinon on le rajoute
        return addGroup(chatId, id).then(_ => {
            bot.sendMessage(chatId, `Ajout du groupe \`${group}\` à la liste des anniversaires.`, { parse_mode: 'Markdown' });
        })
    })
})

bot.onText(/\/del (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    getChanByChatId(chatId).then(chan => {
        const id = parseInt(match[1].split(' ')[0]);
        return Promise.all([
            getGroupById(chan.token, id),
            getGroups(chatId),
            id
        ]);
    }).then(([group, groups, id]) => {
        // si pas de groupe trouvé
        if (!group) return bot.sendMessage(chatId, 'Pas de groupe trouvé ayant cette ID');
        // si le groupe y est déjà
        if (groups.indexOf(id) === -1) return bot.sendMessage(chatId, 'Ce groupe n\'est pas dans votre liste d\'anniversaire.');
        // sinon on le rajoute
        return removeGroup(chatId, id).then(_ => {
            bot.sendMessage(chatId, `Retrait du groupe \`${group}\` de la liste des anniversaires.`, { parse_mode: 'Markdown' });
        })
    })
})

// Ajout d'un rappel
bot.onText(/\/schedule (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const time = match[1];
    if (!RegExp('^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$').test(time)) return bot.sendMessage(chatId, 'Le temps entré n\'est pas au format hh:mm');
    getChanByChatId(chatId).then(chan => {
        if (!chan) return bot.sendMessage(chatId, 'Pas de compte enregistré, faites /start pour commencer');
        return addSchedule(chan, time, bot)
    });
    bot.sendMessage(chatId, `Votre rappel est configuré pour tous les jours à ${time}`);
})


// Suppression du rappel
bot.onText(/\/unschedule/, msg => {
    const chatId = msg.chat.id;
    getChanByChatId(chatId).then(chan => {
        if (!chan) return bot.sendMessage(chatId, 'Pas de compte enregistré, faites /start pour commencer');
        if (chan.schedule == '') return bot.sendMessage(chatId, 'Pas de rappel défini...');

        deleteSchedule(chatId)
        chan.schedule = ''
        return modifyChan(chan)
    }).then(_ => {
        bot.sendMessage(chatId, 'Votre rappel a été supprimé.')
    })
})

// J'étais bien obligé (en vrai c'est pour tester)
bot.onText(/\/nikmarine/, msg => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Nik bien Marine');
    console.log(schedules);
})


module.exports = bot;