// INDEX.JS : Script principal pour lancer le serveur

// Modules propres
var bot = require('./telegram');
require('./website');
var { getSchedules } = require('./mysql');
var { addSchedule } = require('./schedule');

// Reboot proof : au démarrage de l'application, recréaction des rappels
getSchedules().then(chans => {
    chans.forEach(chan => {
        addSchedule(chan, chan.schedule, bot)
    })
    console.log(`[schdles] reload schedules`)
})

