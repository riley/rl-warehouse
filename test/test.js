var config = require('./config.json');

process.env.RL_USER = config.username;
process.env.RL_PASSWORD = config.password;

var warehouse = require('../lib/warehouse');

warehouse.findOrder('53f35be8d389a9436f000002', function (err, order) {
    console.log(JSON.stringify(order, null, 2));
    process.exit();
});

// warehouse.getInventory(function (err, inv) {
//     if (err) console.log(err);
//     console.log(JSON.stringify(inv, null, 2));
//     process.exit();
// });