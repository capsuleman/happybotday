const mongoose = require('mongoose');


mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost/botday', { useNewUrlParser: true })
    .then(() => console.log('[mongoose] Connection succesful'))
    .catch((err) => console.error(err));

module.exports = mongoose;