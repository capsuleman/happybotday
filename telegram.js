// TELEGRAM.JS : Gestion du bot Telegram

process.env["NTBA_FIX_319"] = 1;

// Modules extérieurs
var TelegramBot = require('node-telegram-bot-api');

// Modules propres
var { getChanByChatId, createChan, deleteChanByChatId, modifyChan, addGroup, removeGroup, removeAllGroups, getCompos } = require('./mysql');
var { getBirthdays, searchGroups, getCompoGroupById, getMe } = require('./requests');
var { schedules, addSchedule, deleteSchedule } = require('./schedule');

// Configurations
const config = require('./config');

// Création de variables
var bot = new TelegramBot(config.telegram.token, { polling: true });


// A la connexion, création d'un document Channel dans MongoDB
bot.onText(/\/start/, msg => {
    const chatId = msg.chat.id;
    return getChanByChatId(chatId).then(chan => {
        // /start déjà fait
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
        removeAllGroups(chatId)
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
        if (chan.state.length !== 0) {
            return bot.sendMessage(chatId, `@${chan.username} a déjà fait une demande. Vous pouvez annuler la demande via /cancel ou @${chan.username} peut se connecter depuis ce <a href="${config.website.protocol}://${config.website.hostname}/?state=${chan.state}">test</a>`, { parse_mode: 'HTML' })
        }
        // authentification déjà faite
        if (chan.token.length !== 0) return bot.sendMessage(chatId, `Une connexion a déjà été faite par @${chan.username}. Pour la réinitialiser, faites /disconnect`);
        // dans le reste des cas, création d'un lien pour l'authentification et enregistrement dans l'objet pour être sur
        chan.state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        chan.username = msg.from.username;
        modifyChan(chan).then(chan => {
            const resp = `Pour vous identifier, connectez-vous via l\'OAuth2 de ViaRézo depuis ce <a href="${config.website.protocol}://${config.website.hostname}/?state=${chan.state}">lien</a>\n`;
            return bot.sendMessage(chatId, resp, { parse_mode: 'HTML' });
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
        return getBirthdays(chan)
    }).then(users => {
        if (chatId > 0) { // chan privé
            var msg = 'N\'oubliez pas les <b>anniversaires</b> de :\n'
        } else { // chan à plusieurs
            var msg = '<b>Joyeux anniversaire</b> à :\n'
        }
        users.sort((use1, use2) => use1.promo - use2.promo);
        users.forEach((user, index, array) => {
            if (index !== array.length - 1) {
                msg += `├ <a href = "https://linkcs.fr/user/${user.login}">${user.name}</a>\n`
            } else {
                msg += `└ <a href = "https://linkcs.fr/user/${user.login}">${user.name}</a>\n`
            }
        })
        return bot.sendMessage(chatId, msg, { parse_mode: 'HTML' });
    })
});

// Affiche les anniversaires demandés
bot.onText(/\/birthdays/, msg => {
    const chatId = msg.chat.id;
    // recherche du token du chan actuel
    getChanByChatId(chatId).then(chan => {
        return Promise.all([
            getBirthdays(chan),
            getCompos(chatId)
        ])
    }).then(([users, groups]) => {
        // récupère que les personnes du jour qui font partie des groupes ciblés
        const newUsers = users.filter(user => user.asso.some(asso => groups.indexOf(asso) !== -1));
        if (newUsers.length === 0) return bot.sendMessage(chatId, 'Pas d\'anniversaire à souhaiter aujourd\'hui.')
        if (chatId > 0) { // chan privé
            var msg = 'N\'oubliez pas les <b>anniversaires</b> de :\n'
        } else { // chan à plusieurs
            var msg = '<b>Joyeux anniversaire</b> à :\n'
        }
        newUsers.sort((use1, use2) => use1.promo - use2.promo);
        newUsers.forEach((user, index, array) => {
            if (index !== array.length - 1) {
                msg += `├ <a href = "https://linkcs.fr/user/${user.login}">${user.name}</a>\n`
            } else {
                msg += `└ <a href = "https://linkcs.fr/user/${user.login}">${user.name}</a>\n`
            }
        })
        return bot.sendMessage(chatId, msg, { parse_mode: 'HTML' });
    })
});

// recherche des groupes et renvoie le résultat avec leurs ID pour les rajouter
bot.onText(new RegExp(`/search (.+)|/search@${config.telegram.name} (.+)`), (msg, match) => {
    const chatId = msg.chat.id;
    const research = match[0].split(' ')[1];
    getChanByChatId(chatId).then(chan => {
        return searchGroups(chan, research)
    }).then(groups => {
        if (groups.length == 0) return bot.sendMessage(chatId, 'Pas de groupe à ce nom...');
        const aleatgroup = groups[Math.floor(Math.random() * groups.length)];
        const aleatcompo = aleatgroup.compositions[Math.floor(Math.random() * aleatgroup.compositions.length)];
        var resp = `Voici les différentes associations et leurs compositions. Pour ajouter les membres d'une composition à votre liste d'anniversaire, faites par exemple /add ${aleatcompo.id} pour ajouter les membres de la composition ${aleatcompo.label} de l'asso ${aleatgroup.name}. `;
        // LinkCS limite à 20 résultats
        if (groups.length == 20) resp += 'La recherche est limitée à 20 choix.'
        resp += '\n\n'
        groups.forEach(group => {
            resp += `<a href="https://linkcs.fr/association/${group.code}">${group.name}</a>\n`;
            group.compositions.sort((compo1, compo2) => Date.parse(compo1.beginningDate) - Date.parse(compo2.beginningDate));
            group.compositions.forEach((compo, index, array) => {
                if (index !== array.length - 1) {
                    resp += `├ ${compo.label} (id : ${compo.id})\n`
                } else {
                    resp += `└ ${compo.label} (id : ${compo.id})\n`
                }
            })
        })
        bot.sendMessage(chatId, resp, { parse_mode: 'HTML' });
    });
})

// Ajout d'un groupe dans la liste des groupes
bot.onText(new RegExp(`/add (.+)|/add@${config.telegram.name} (.+)`), (msg, match) => {
    const chatId = msg.chat.id;
    getChanByChatId(chatId).then(chan => {
        const id = parseInt(match[0].split(' ')[1]);
        return Promise.all([
            getCompoGroupById(chan, id),
            getCompos(chatId),
            id
        ]);
    }).then(([cg, groups, id]) => {
        // si pas de groupe trouvé
        if (!cg) return bot.sendMessage(chatId, 'Pas de composition trouvé ayant cette ID');
        // si le groupe y est déjà
        if (groups.indexOf(id) !== -1) return bot.sendMessage(chatId, 'Cette composition est déjà est dans votre liste d\'anniversaire.');
        // sinon on le rajoute
        return addGroup(chatId, id).then(_ => {
            bot.sendMessage(chatId, `Ajout de la composition \`${cg.compo.name}\` du groupe \`${cg.group.name}\` à la liste des anniversaires.`, { parse_mode: 'Markdown' });
        })
    })
})

bot.onText(new RegExp(`/del (.+)|/del@${config.telegram.name} (.+)`), (msg, match) => {
    const chatId = msg.chat.id;
    getChanByChatId(chatId).then(chan => {
        const id = parseInt(match[0].split(' ')[1]);
        return Promise.all([
            getCompoGroupById(chan, id),
            getCompos(chatId),
            id
        ]);
    }).then(([cg, groups, id]) => {
        // si pas de groupe trouvé
        if (!cg) return bot.sendMessage(chatId, 'Pas de composition trouvé ayant cette ID');
        // si le groupe y est déjà
        if (groups.indexOf(id) === -1) return bot.sendMessage(chatId, 'Cette composition n\'est pas dans votre liste d\'anniversaire.');
        // sinon on le rajoute
        return removeGroup(chatId, id).then(_ => {
            bot.sendMessage(chatId, `Retrait de la composition \`${cg.compo.name}\` du groupe \`${cg.group.name}\` à la liste des anniversaires.`, { parse_mode: 'Markdown' });
        })
    })
})

// Ajout d'un rappel
bot.onText(new RegExp(`/schedule (.+)|/schedule@${config.telegram.name} (.+)`), (msg, match) => {
    const chatId = msg.chat.id;
    const time = match[0].split(' ')[1];
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
        if (!chan) return bot.sendMessage(chatId, 'Pas de compte enregistré, faites /start pour commencer.');
        if (chan.schedule == '') return bot.sendMessage(chatId, 'Pas de rappel défini...');

        deleteSchedule(chatId)
        chan.schedule = ''
        return modifyChan(chan)
    }).then(_ => {
        bot.sendMessage(chatId, 'Votre rappel a été supprimé.')
    })
})

// Renvoi les infos du chan
bot.onText(/\/info/, msg => {
    const chatId = msg.chat.id;
    // il faut chercher le gars sur l'auth.viarezo.fr/me
    getChanByChatId(chatId).then(chan => {
        // gestion des cas où l'utilisateur n'est pas totalement connecté
        if (!chan) return bot.sendMessage(chatId, 'Pas de compte enregistré, faites /start pour commencer.');
        if (chan.username.length === 0 && chan.token.length === 0) return bot.sendMessage(chatId, 'Pas de demande de connexion faite, tapez /connect pour en envoyer une.');
        if (chan.token.length === 0) return bot.sendMessage(chatId, `Une demande de connexion a été faite par @${chan.username} mais n'a toujours pas été acceptée.\n${config.website.protocol}://${config.website.hostname}/?state=${chan.state}`);
        return Promise.all([
            getMe(chan),
            getCompos(chan.chatId).then(groups => {
                return Promise.all(groups.map(group => getCompoGroupById(chan, group)))
            })
        ]).then(([me, cgs]) => {
            groups = {}
            cgs.forEach(cg => {
                if (!groups[cg.group.id]) {
                    groups[cg.group.id] = { name: cg.group.name, compo: [] };
                }
                groups[cg.group.id].compo.push(cg.compo)
            })

            // affiche qui s'est connecté
            var msg = `${me.firstName} ${me.lastName} (@${chan.username}) s'est connecté à l'OAuth.\n\n`;

            // affiche le moment du rappel journalier
            if (chan.schedule.length !== 0) {
                msg += `Les rappels sont prévus tous les jours à ${chan.schedule}.\n`;
                msg += 'Vous pouvez annuler ces rappels via /unschedule\n\n'
            } else {
                msg += `Vous n'avez pas de rappel journalier.\n`
                msg += `Vous pouvez faire /schedule hh:mm pour en ajouter un.\n\n`
            }

            // affiche la liste des associations à souhait
            if (cgs.length === 0) {
                msg += 'La liste des compositions est vide.\n';
                msg += 'Vous pouvez en chercher via /search sonNom, puis faire un /add sonID\n'
            } else {
                msg += `Les personnes faisant parti de ces compositions auront leur anniversaire rapellé :\n`;
                Object.keys(groups).forEach(key => {
                    msg += `${groups[key].name}\n`
                    groups[key].compo.sort((compo1, compo2) => Date.parse(compo1.beginningDate) - Date.parse(compo2.beginningDate));
                    groups[key].compo.forEach((compo, index, array) => {
                        if (index !== array.length - 1) {
                            msg += `├ ${compo.name} (id : ${compo.id})\n`
                        } else {
                            msg += `└ ${compo.name} (id : ${compo.id})\n`
                        }
                    })

                });
            }
            bot.sendMessage(chatId, msg);
        })
    })
})

// J'étais bien obligé (en vrai c'est pour tester)
bot.onText(/\/nikmarine/, msg => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Nik bien Marine');
    console.log(schedules);
})


module.exports = bot;