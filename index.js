const bot = require('./telegram');
const app = require('./website');
const mongoose = require('./mongoose');
const { sendRequest, getBirthdays } = require('./requests');
const Channel = require('./models/Channel');
