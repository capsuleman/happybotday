Fichier de configuration `config.js`

``` js
const config = {
    telegram: {
        token: '',
        admin_chat: 
    },
    oauth2: {
        clientid: '',
        secretid: '',
        scope: 'default linkcs-asso:read linkcs-user:read'
    },
    website: {
        hostname: '',
        protocol: '',
        port: 
    },
    mysql: {
        host: '',
        user: '',
        password: '',
        database: ''
    }
};

module.exports = config;
```