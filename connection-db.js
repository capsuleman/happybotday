// CONNECTION-DB : Module de connexion à la base de données et fonctions pour modifier groupes et chans

// Modules extérieurs
var mysql = require('promise-mysql');

// Configurations
const config = require('./config');



function query(req) {
    return mysql.createConnection(
        config.mysql
    ).then(connection => {
        return Promise.all([
            connection.query(req),
            connection
        ])
    }).then(([rep, connection]) => {
        connection.end();
        return rep;
    }).catch(error => {
        //logs out the error
        console.error(error);
    });
}


Promise.all([
    query(`CREATE TABLE IF NOT EXISTS channel(
    chatId INT PRIMARY KEY NOT NULL,
    username TEXT,
    state TEXT,
    token TEXT,
    refresh TEXT,
    expiration TEXT,
    schedule TEXT
)`),

    query(`CREATE TABLE IF NOT EXISTS groups(
    chatId INT NOT NULL,
    grp INT,
    primary key (chatId, grp)
)`)
]).then(_ => {

    console.log('[mariadb] connected to database')

})



function getChanByChatId(chatId) {
    return query(`
    SELECT *
    FROM channel
    WHERE chatId = ${chatId}
    `).then(rep => rep[0]);
}

function createChan(chatId) {
    return query(`
    INSERT INTO channel
    VALUES (${chatId}, "", "", "", "", "", "")
    `)
}

function deleteChanByChatId(chatId) {
    return query(`DELETE FROM channel WHERE chatId = ${chatId}`);
}

function modifyChan(data) {
    return query(`
        UPDATE channel
        SET username = "${data.username}",
            state = "${data.state}",
            token = "${data.token}",
            refresh = "${data.refresh}",
            expiration = "${data.expiration}",
            schedule = "${data.schedule}"
        WHERE chatId = ${data.chatId}
    `).then(_ => {
        return getChanByChatId(data.chatId)
    })
}

function getChanByState(state) {
    return query(`
    SELECT *
    FROM channel
    WHERE state = "${state}"
    `).then(rep => rep[0]);
}

function addGroup(chatId, groupId) {
    return query(`
    INSERT INTO groups
    VALUES (${chatId}, ${groupId})
    `);
}

function removeGroup(chatId, groupId) {
    return query(`
    DELETE FROM groups WHERE chatId = ${chatId} AND grp = ${groupId}`)
}

function removeAllGroups(chatId) {
    return query(`
    DELETE FROM groups WHERE chatId = ${chatId}`)
}

function getGroups(chatId) {
    return query(`
    SELECT grp
    FROM groups
    WHERE chatId = ${chatId}
    `).then(rep => {
        return rep.map(element => element.grp);
    })
}

function getSchedules() {
    return query(`
    SELECT *
    FROM channel
    WHERE schedule <> ""
    `)
}


module.exports = { query, getChanByChatId, createChan, deleteChanByChatId, modifyChan, getChanByState, addGroup, removeGroup, removeAllGroups, getGroups, getSchedules };