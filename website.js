// Modules extérieurs
var app = require('express')();
var rp = require('request-promise');

// Modules propres
var bot = require('./telegram');
var { modifyChan, getChanByState } = require('./connection-db');

// Configurations
const config = require('./config');


app.listen(80, '127.0.0.1', () => {
    console.log(`[express] Website is up and accessible on ${config.website.protocol}://${config.website.hostname}/`);
})

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

    const options = {
        url: 'https://auth.viarezo.fr/oauth/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        form: {
            grant_type: 'authorization_code',
            code: req.query.code,
            redirect_uri: config.website.protocol + '://' + config.website.hostname + '/auth',
            client_id: config.oauth2.clientid,
            client_secret: config.oauth2.secretid
        }
    }

    return rp(options).then(body => {
        return Promise.all([body, getChanByState(req.query.state)])
    }).then(([body, chan]) => {
        if (!chan) return
        rep = JSON.parse(body);
        chan.token = rep.access_token;
        chan.refresh = rep.refresh_token;
        chan.expiration = rep.expires_at;
        chan.state = '';
        return modifyChan(chan)
    }).then(chan => {
        bot.sendMessage(chan.chatId, `@${chan.username} s'est connecté à OAuth2, shall we begin?`)
        res.redirect(301, `${config.website.protocol}://${config.website.hostname}/auth`)
    })
})


module.exports = app;