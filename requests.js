// Modules extérieurs
const rp = require('request-promise');

// Modules propres
var { modifyChan } = require('./connection-db');

// Configurations
const config = require('./config');

// Fonction d'envoi d'une requête au GraphQL de LinkCS 
async function sendRequest(req, token) {
    const options = {
        headers: { 'Authorization': `Bearer ${token}` },
        json: true
    }
    const url = 'https://gateway.linkcs.fr/v1/graphql';

    return rp(`${url}?query=${req}`, options)
}

// Récupération de tous les personnes et leurs assos ayant leur anniversaire
function getBirthdays(token) {
    const req = 'query getUsersBirthday {users: usersBirthday {    ...userData}}fragment userData on User {firstName  lastName  roles {sector {composition {association {id}}}}}'
    return sendRequest(req, token).then(body => {
        const users = [];
        body.data.users.forEach(user => {
            use = {};
            use.name = `${user.firstName} ${user.lastName}`;
            use.asso = [];
            user.roles.forEach(role => {
                use.asso.push(role.sector.composition.association.id);
            })
            users.push(use);
        });
        return users;
    })
}

// Récupération de la recherche de groupe
function searchGroups(token, term) {
    const req = `query {searchAssociations(term: "${term}") {id name code}}`
    return sendRequest(req, token).then(body => {
        if (!body.data) return;
        return body.data.searchAssociations;
    }).catch(err => { console.error(err) })
}

// Récupération du nom de l'asso ayant l'ID donnée
function getGroupById(token, id) {
    const req = `query {association(id: ${id}) {name}}`
    return sendRequest(req, token).then(body => {
        if (!body.data) return;
        return body.data.association.name;
    }).catch(err => { console.error(err) })
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
        chan.expiration = rep.expires_at * 1000;
        return modifyChan(chan)
    })
};

module.exports = { getBirthdays, sendRequest, searchGroups, getGroupById, getNewToken };