const rp = require('request-promise');

const Channel = require('./models/Channel');


function sendRequest(req, token) {
    const options = {
        headers: { 'Authorization': `Bearer ${token}` },
        json: true
    }
    const url = 'https://gateway.linkcs.fr/v1/graphql';

    return rp(`${url}?query=${req}`, options)
}


function getBirthdays(token) {
    const req = 'query getUsersBirthday {users: usersBirthday {    ...userData}}fragment userData on User {id  firstName  lastName  roles {sector {composition {association {id}}}}}'
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


function searchGroups(token, term) {
    const req = `query {searchAssociations(term: "${term}") {id name code}}`
    return sendRequest(req, token).then(body => {
        if (!body.data) return;
        return body.data.searchAssociations;
    }).catch(err => { console.error(err) })
}

function getGroupById(token, id) {
    const req = `query {association(id: ${id}) {name}}`
    return sendRequest(req, token).then(body => {
        if (!body.data) return;
        return body.data.association.name;
    }).catch(err => { console.error(err) })
}

module.exports = { getBirthdays, sendRequest, searchGroups, getGroupById };