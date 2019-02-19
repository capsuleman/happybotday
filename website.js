const config = require('./config');

const app = require('express')();
const rp = require('request-promise');
const bot = require('./telegram');
const Channel = require('./models/Channel');

app.listen(80, config.website.hostname, () => {
    console.log(`[express] Website is up and accessible on ${config.website.protocol}://${config.website.hostname}/`);
})

app.get('/', function (req, res) {

    if (!req.query.state) { return res.sendFile(`${__dirname}/index.html`) };

    Channel.findOne({ state: req.query.state }).then(chan => {

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
        return Promise.all([body, Channel.findOne({ state: req.query.state })])
    }).then(([body, chan]) => {
        if (!chan) { return req.query.state }
        rep = JSON.parse(body);
        console.log(rep);
        chan.token = rep.access_token;
        chan.refresh = rep.refresh_token;
        chan.expiration = rep.expires_at * 1000;
        chan.state = '';
        return chan.save()
    }).then(chan => {
        bot.sendMessage(chan.chatId, `@${chan.username} s'est connecté à OAuth2, shall we begin?`);
        return res.redirect(301, `${config.website.protocol}://${config.website.hostname}/auth`)
    })
})


module.exports = app;