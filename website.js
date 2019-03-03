// WEBSITE.JS : Gestion du site web

// Modules extérieurs
var app = require('express')();

// Modules propres
var bot = require('./telegram');
var { getChanByState } = require('./mysql');
var { getFirstToken } = require('./requests');

// Configurations
const config = require('./config');



// Lancement du site
app.listen(config.website.port, '127.0.0.1', () => {
    console.log(`[express] Website is up and accessible on ${config.website.protocol}://${config.website.hostname}/`);
})


// Page de base, si argument 
app.get('/', function (req, res) {

    // GET / : renvoie la page de base
    if (!req.query.state) return res.sendFile(`${__dirname}/index.html`);
    // surement une tentative de XSS (plus gros point d'entrée)
    if (req.query.state.indexOf(';') !== -1) return res.sendFile(`${__dirname}/index.html`);

    getChanByState(req.query.state).then(chan => {

        if (!chan || chan.token) return res.sendFile(`${__dirname}/index.html`);

        const redirectURI = `${config.website.protocol}://${config.website.hostname}/auth`;
        const url = `https://auth.viarezo.fr/oauth/authorize/?redirect_uri=${redirectURI}&client_id=${config.oauth2.clientid}&response_type=code&state=${chan.state}&scope=${config.oauth2.scope}`;
        return res.redirect(301, url);
    })

})

app.get('/background.jpg', function (req, res) {
    res.sendFile(`${__dirname}/background.jpg`)
})


app.get('/auth', function (req, res) {

    if (!req.query.code || !req.query.state) return res.sendFile(`${__dirname}/auth.html`)

return getFirstToken(req.query.code, req.query.state).then(chan => {
        bot.sendMessage(chan.chatId, `@${chan.username} s'est connecté à OAuth2, shall we begin?`)
        res.redirect(301, `${config.website.protocol}://${config.website.hostname}/auth`)
    })
})

app.get('/namebot', function (req, res) {
    return res.send(config.telegram.name);
})

module.exports = app;