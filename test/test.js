var config = require('./config.json');

process.env.RL_USER = config.username;
process.env.RL_PASSWORD = config.password;

var warehouse = require('../lib/warehouse');

warehouse.findOrder('11128654', function (err, order) {
    if (err) {
        console.log(err);
    } else {
        console.log(JSON.stringify(order, null, 2));
    }
    process.exit();


});

// warehouse.getInventory(function (err, inv) {
//     if (err) console.log(err);
//     console.log(JSON.stringify(inv, null, 2));
//     process.exit();
// });