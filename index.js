const bot = require('./telegram');
const app = require('./website');
const mongoose = require('./mongoose');
const Token = require('./models/Token');

const rp = require('request-promise');

function sendRequest(req, token, callback) {
    const options = {
        headers: { 'Authorization': `Bearer ${token}` },
        json: true
    }
    const url = 'https://gateway.linkcs.fr/v1/graphql';


    return rp(`${url}?query=${req}`, options)
}


function getBirthdays(token) {
    req = 'query getUsersBirthday {users: usersBirthday {    ...userData}}fragment userData on User {id  firstName  lastName  roles {sector {composition {association {id}}}}}'
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

// Token.findOne({ expiration: { $gt: Date.now() } }).then(token => {
//     getBirthdays(token.token).then(a => console.log(a));
// })