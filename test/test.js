var config = require('./config.json');

process.env.RL_USER = config.username;
process.env.RL_PASSWORD = config.password;
process.env.THREE_PL_KEY = config.threePLKey;
process.env.NODE_ENV = 'production';

var warehouse = require('../lib/warehouse');

// test findOrder endpoint
// warehouse.findOrder('14a3cb4f74e').then(function (order) {
//     console.log('the order?', order);
// }).catch(function (e) {
//     console.log('test failed to find order', e);
// });

// test inventory endpoint
// warehouse.getInventory().then(console.log).catch(console.log).finally(process.exit);

// test order creation
warehouse.createSingleOrder({
    id: '14a544dbda0',
    email: 'katkiernanphotography@gmail.com',
    name: 'Louis K. Meisel Gallery',
    address_1: '141 Prince Street',
    address_2: 'Attn: Kat Kiernan',
    city: 'New York',
    state: 'NY',
    zip: '10012',
    shippingMode: 'First Class Mail',
    country: 'United States',
    skus: [{
        sku: 'Tone-M-Ushirt-M',
        quantity: 2
    }]
}).then(function (info) {
    console.log('order processed successfully');
    console.log(JSON.stringify(info, null, 2));
}).catch(function (e) {
    console.log('error shipping order', e);
});