var config = require('./config.json');

process.env.RL_USER = config.username;
process.env.RL_PASSWORD = config.password;
process.env.THREE_PL_KEY = config.threePLKey;
process.env.NODE_ENV = 'production';

var warehouse = require('../lib/warehouse');
var assert = require('chai').assert;

// test findOrder endpoint
// warehouse.findOrder('14a3cb4f74e').then(function (order) {
//     console.log('the order?', order);
// }).catch(function (e) {
//     console.log('test failed to find order', e);
// });

// test inventory endpoint
// warehouse.getInventory().then(console.log).catch(console.log).finally(process.exit);

// test finding orders
describe('warehouse', function () {
    describe('#findOrder', function () {
        it('should throw an error if no order id is passed as a String', function () {
            assert.throw(warehouse.findOrder, TypeError);
        });
        it('should throw an error if a callback is passed as the second argument', function () {
            assert.throw(warehouse.findOrder.bind(warehouse, 'order1234', function () {}), TypeError);
        });
    });
});


// warehouse.createSingleOrder({
//     id: '',
//     email: '',
//     name: '',
//     address_1: '',
//     address_2: '',
//     city: '',
//     state: '',
//     zip: '',
//     shippingMode: 'Priority Mail',
//     country: 'United States',
//     skus: [{
//         sku: 'Tone-M-Ushirt-M',
//         quantity: 1
//     }]
// }).then(function (info) {
//     console.log('order processed successfully');
//     console.log(JSON.stringify(info, null, 2));
// }).catch(function (e) {
//     console.log('error shipping order', e);
// });