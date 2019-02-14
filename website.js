const config = require('./config');

const app = require('express')();
const request = require('request');
const bot = require('./telegram');

app.listen(80, config.website.hostname, () => {
    console.log(`[express] Website is up and accessible on ${config.website.protocol}://${config.website.hostname}/`);
})

app.get('/', function (req, res) {
    if (!req.query.chatid) { return res.sendFile(`${__dirname}/index.html`) };

    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const redirectURI = config.website.protocol + '://' + config.website.hostname + '/auth';
    const url = `https://auth.viarezo.fr/oauth/authorize/?redirect_uri=${redirectURI}&client_id=${config.oauth2.clientid}&response_type=code&state=${state}&scope=${config.oauth2.scope}`;
    return res.redirect(301, url);
})

app.get('/background.jpg', function (req, res) {
    res.sendFile(`${__dirname}/background.jpg`)
})

app.get('/auth', function (req, res) {
    if (!req.query.code || !req.query.state) { return res.sendFile(`${__dirname}/auth.html`) }

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

    request(options, (err, res, body) => {
        console.log(res.statusCode);
        if (!err && res.statusCode == 200) {
            console.log(body)
        }
    })
    return res.redirect(301, `${config.website.protocol}://${config.website.hostname}/auth`);
})

module.exports = app;