var warehouse = require('../lib/warehouse');

warehouse.findOrder('53b75VEX', function (err, order) {
    console.log(order);
    process.exit();
});