// Modules extérieurs
var schedule = require('node-schedule');

// Modules propres
var { modifyChan, getGroups } = require('./connection-db');
var { getBirthdays, getNewToken } = require('./requests');

// Création de variables
var schedules = {};



// En cas de redémarrage de l'appli
// query(`SELECT chatId, schedule FROM channel WHERE schedule <> ""`).then(rep => {
//     rep.forEach(chan => {
// 
//     })
// })


function addSchedule(chan, time, bot) {
    const hour = parseInt(time.split(':')[0]);
    const minute = parseInt(time.split(':')[1]);
    chan.schedule = time;
    return Promise.all([
        modifyChan(chan),
        getGroups(chan.chatId)
    ]).then(([chan, groups]) => {
        schedules[chan.chatId] = schedule.scheduleJob({ hour: hour, minute: minute }, function () {
            return getNewToken(chan).then(chan => {
                return getBirthdays(chan.token)
            }).then(users => {
                // récupère que les personnes du jour qui font partie des groupes ciblés
                const newUsers = users.filter(user => user.asso.some(asso => groups.indexOf(asso) !== -1));
                if (newUsers.length === 0) return
                var msg = '**Joyeux anniversaire** à :\n'
                newUsers.forEach(user => {
                    msg += `${user.name}\n`
                });
                return bot.sendMessage(chan.chatId, msg, { parse_mode: 'Markdown' });
            })
        })
    })
};

function deleteSchedule(chatId) {
    if (schedules[chatId]) {
        schedules[chatId].cancel();
        delete (schedules[chatId]);
    }
}



module.exports = { schedules, addSchedule, deleteSchedule }