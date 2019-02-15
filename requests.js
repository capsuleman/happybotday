const rp = require('request-promise');

const Token = require('./models/Token');


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

module.exports = { getBirthdays, sendRequest };