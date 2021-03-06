// SCHEDULE.JS : Module permettant de créer des rappels d'anniversaires

// Modules extérieurs
var schedule = require('node-schedule');

// Modules propres
var { modifyChan, getCompos } = require('./mysql');
var { getBirthdays, getNewToken } = require('./requests');

// Création de variables
var schedules = {};


function addSchedule(chan, time, bot) {
    const hour = parseInt(time.split(':')[0]);
    const minute = parseInt(time.split(':')[1]);
    chan.schedule = time;
    return modifyChan(chan).then(chan => {
        schedules[chan.chatId] = schedule.scheduleJob({ hour: hour, minute: minute }, function () {
            return getNewToken(chan).then(chan => {
                return Promise.all([
                    getBirthdays(chan),
                    getCompos(chan.chatId)
                ])
            }).then(([users, groups]) => {
                // récupère que les personnes du jour qui font partie des groupes ciblés
                const newUsers = users.filter(user => user.asso.some(asso => groups.indexOf(asso) !== -1));
                if (newUsers.length === 0) return
                if (chan.chatId > 0) { // chan privé
                    var msg = 'N\'oubliez pas les <b>anniversaires</b> de :\n'
                } else { // chan à plusieurs
                    var msg = '<b>Joyeux anniversaire</b> à :\n'
                }
                newUsers.forEach((user, index, array) => {
                    if (index !== array.length - 1) {
                        msg += `├ <a href = "https://linkcs.fr/user/${user.login}">${user.name}</a>\n`
                    } else {
                        msg += `└ <a href = "https://linkcs.fr/user/${user.login}">${user.name}</a>\n`
                    }
                })
                return bot.sendMessage(chan.chatId, msg, { parse_mode: 'HTML' });
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