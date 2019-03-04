// REQUESTS.JS : Envoi de requête HTTP vers l'OAuth de VR et vers LinkCS 

// Modules extérieurs
const rp = require('request-promise');

// Modules propres
var { modifyChan, getChanByState, addUser } = require('./mysql');

// Configurations
const config = require('./config');




// Fonction d'envoi d'une requête au GraphQL de LinkCS 
async function sendRequest(req, chan) {
    // A chaque requête vérifie si le token est encore valable, sinon va en récupérer un nouveau
    return getNewTokenIfNecessary(chan).then(chan => {
        const options = {
            headers: { 'Authorization': `Bearer ${chan.token}` },
            json: true
        }
        const url = 'https://gateway.linkcs.fr/v1/graphql';

        return rp(`${url}?query=${req}`, options)
    })
}

// Récupération de tous les personnes et leurs assos ayant leur anniversaire
function getBirthdays(chan) {
    const req = 'query getUsersBirthday {users: usersBirthday {    ...userData}}fragment userData on User {firstName  lastName  roles {sector {composition {id}}}}'
    return sendRequest(req, chan).then(body => {
        const users = [];
        body.data.users.forEach(user => {
            use = {};
            use.name = `${user.firstName} ${user.lastName}`;
            use.asso = [];
            user.roles.forEach(role => {
                use.asso.push(role.sector.composition.id);
            })
            users.push(use);
        });
        return users;
    })
}

// Récupération de la recherche de groupe
function searchGroups(chan, term) {
    const req = `query {searchAssociations(term: "${term}") {name code compositions { id label beginningDate}}}`
    return sendRequest(req, chan).then(body => {
        if (!body.data) return;
        return body.data.searchAssociations;
    }).catch(err => { console.error(err) })
}

// Récupération du nom de l'asso ayant l'ID donnée
function getGroupById(chan, id) {
    const req = `query {association(id: ${id}) {name}}`
    return sendRequest(req, chan).then(body => {
        if (!body.data) return;
        return body.data.association.name;
    }).catch(err => { console.error(err) })
}

// Récupération des infos sur une compo (nom, id, asso)
function getCompoGroupById(chan, id) {
    const req = `query {composition(id: ${id}) {id label beginningDate association {id name}}}`
    return sendRequest(req, chan).then(body => {
        if (!body.data) return;
        return {
            compo: {
                name: body.data.composition.label,
                id: body.data.composition.id,
                beginningDate: body.data.composition.beginningDate
            },
            group: {
                name: body.data.composition.association.name,
                id: body.data.composition.association.id
            }
        };
    }).catch(err => { console.error(err) })
}

// Récupération des infos persodepuis l'auth VR
function getMe(chan) {
    return getNewTokenIfNecessary(chan).then(chan => {
        const options = {
            headers: { 'Authorization': `Bearer ${chan.token}` },
            json: true
        }

        return rp('https://auth.viarezo.fr/api/user/show/me', options)
    })
}

// Récupération d'un token
function getFirstToken(code, state) {

    const options = {
        url: 'https://auth.viarezo.fr/oauth/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        form: {
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: config.website.protocol + '://' + config.website.hostname + '/auth',
            client_id: config.oauth2.clientid,
            client_secret: config.oauth2.secretid
        }
    }

    return Promise.all([
        rp(options),
        getChanByState(state)
    ]).then(([body, chan]) => {
        if (!chan) return
        rep = JSON.parse(body);
        chan.token = rep.access_token;
        chan.refresh = rep.refresh_token;
        chan.expiration = rep.expires_at;
        chan.state = '';
        if (chan.chatId > 0) {
            getMe(chan).then(me => {
                addUser({
                    userid: me.id,
                    name: `${me.firstName} ${me.lastName}`,
                    username: chan.username
                })
            })
        }
        return modifyChan(chan)
    })
}

// Récupération d'un nouveau token
function getNewToken(chan) {

    const options = {
        url: 'https://auth.viarezo.fr/oauth/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        form: {
            grant_type: 'refresh_token',
            refresh_token: chan.refresh,
            client_id: config.oauth2.clientid,
            client_secret: config.oauth2.secretid
        }
    }

    return rp(options).then(body => {
        if (!chan) { return req.query.state }
        rep = JSON.parse(body);
        chan.token = rep.access_token;
        chan.refresh = rep.refresh_token;
        chan.expiration = rep.expires_at;
        return modifyChan(chan)
    })
};

// Récupère un nouveau token que si besoin
function getNewTokenIfNecessary(chan) {
    if (chan.expiration * 1000 < Date.now()) {
        return getNewToken(chan)
    } else {
        return Promise.resolve(chan)
    }
}

module.exports = {
    getBirthdays,
    sendRequest,
    searchGroups,
    getGroupById,
    getCompoGroupById,
    getMe,
    getFirstToken,
    getNewToken
};