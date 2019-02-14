require('./telegram');
const config = require('./config');

var app = require('express')();

app.listen(80, config.website.hostname, () => {
    console.log(`[express] Website is up and accessible on ${config.website.protocol}://${config.website.hostname}`);
})

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html')
})

app.get('/background.jpg', function (req, res) {
    res.sendFile(__dirname + '/background.jpg')
})

app.get('/auth', function (req, res) {
    res.sendFile(__dirname + '/auth.html');
})

app.get('/:id', function (req, res) {
    res.send(req.params.id)
})