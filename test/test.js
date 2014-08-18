var config = require('./config.json');

process.env.RL_USER = config.username;
process.env.RL_PASSWORD = config.password;

var warehouse = require('../lib/warehouse');

// warehouse.findOrder('53f20a697140dbb565000001', function (err, order) {
//     process.exit();
// });

warehouse.getInventory(function (err, inv) {
    if (err) console.log(err);
    console.log(JSON.stringify(inv, null, 2));
    process.exit();
});