var config = require('./config.json');

process.env.RL_USER = config.username;
process.env.RL_PASSWORD = config.password;
process.env.THREE_PL_KEY = config.threePLKey;
process.env.NODE_ENV = 'production';

var warehouse = require('../lib/warehouse');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var assert = chai.assert;

// test finding orders
describe('warehouse', function () {
    describe('#findOrder', function () {
        var validOrderId = '14a3cb4f74e';

        it('should throw an error if no order id is passed as a String', function () {
            assert.throw(warehouse.findOrder, TypeError);
        });
        it('should throw an error if a callback is passed as the second argument', function () {
            assert.throw(warehouse.findOrder.bind(warehouse, validOrderId, function () {}), TypeError);
        });

        it('should return an object if an order is found', function () {
            assert.eventually.isObject(warehouse.findOrder(validOrderId));
        });

        // going to have to figure out sinon and mocks?
        // it('should have error property if order is not found', function (done) {
        //     warehouse.findOrder(validOrderId).catch(done);
        // });

        it('should return a Promise', function () {
            assert.instanceOf(warehouse.findOrder(validOrderId), 'Promise');
        });
    });

    describe('#getInventory', function () {

    });

    describe('#cancelOrder', function () {

    });

    describe('#updateOrder', function () {

    });

    describe('#createItems', function () {

    });

    describe('#createSingleOrder', function () {

    });
});