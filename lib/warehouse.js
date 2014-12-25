var Promise = require('bluebird');
var request = Promise.promisifyAll(require('request'));
var xml2js = Promise.promisifyAll(require('xml2js'));
var fs = Promise.promisifyAll(require('fs'));
// var parseString = require('xml2js').parseString;
var _ = require('underscore');
var countriesMap = require('./countriesMap.json');

var soapActions = {
    'Find Order': "http://www.JOI.com/schemas/ViaSub.WMS/FindOrders",
    'Create Order': "http://www.JOI.com/schemas/ViaSub.WMS/CreateOrders",
    'Inventory': "http://www.JOI.com/schemas/ViaSub.WMS/ReportStockStatus"
};

if (typeof process.env.RL_USER !== 'string' || typeof process.env.RL_PASSWORD !== 'string') {
    throw new Error('must define RL_USER and RL_PASSWORD as envrionment variables. They were ' + typeof process.env.RL_USER + ' and ' + typeof process.env.RL_PASSWORD);
}


// take an order and change fields so that it will go through the janky RL api
function validateOrder (order) {
    // remove ampersands in shipping address

    order.address_1 = order.address_1.replace(/&/g, 'and');
    order.address_2 = order.address_2.replace(/&/g, 'and');
    order.city = order.city.replace(/&/g, 'and');

    // replace USPS country with RL country
    order.country = countriesMap[order.country];

    if (order.country === 'United States' && order.state.trim().match(/^dc/i)) {
        order.city = 'Washington';
        order.state = 'District of Columbia';
    }

    // var shippingMode = null;
    // if (order.shipping.free === true) {
    //     var isUS = (order.shippingAddress.country === 'United States');

    //     shippingMode = (isUS && order.actualWeight > 1 || !isUS && order.actualWeight > 4) ? 'Priority Mail' : 'First Class Mail';
    // } else {
    //     shippingMode = order.shipping.service;
    // }

    // if (order.shipping.domestic !== true) {
    //     shippingMode = order.shipping.service;
    // }

    // order.shippingMode = shippingMode;
    return order;
}

/*
* _request is a utility function --
* it gets xml from the server and converts it into a json blob.

* param - endpoint (which SOAP endpoint we're mapping to)
* param - body (the xml string which is sent as the POST body)
*/

function _request (endpoint, body) {

    var headers = {
        'Content-Type': 'text/xml; charset=utf-8',
        'Host': 'app02.3plcentral.com'
        // 'Host': 'secure-wms.com'
    };

    headers.SOAPAction = soapActions[endpoint];

    var requestParams = {
        url: 'https://app02.3plcentral.com/webserviceexternal/contracts.asmx',
        // url: 'https://secure-wms.com/webserviceexternal/contracts.asmx',
        // method: 'POST',
        headers: headers,
        body: body
    };

    if (process.env.NODE_ENV !== 'production' && endpoint === 'Create Order') {
        process.exit('trying to send orders to live RL server.');
    }

    return request.postAsync(requestParams).spread(function (response, xmlString) {
        xmlString = xmlString.replace(/&lt;/g, '<');
        xmlString = xmlString.replace(/&gt;/g, '>');
        return xml2js.parseStringAsync(xmlString);
    });
}

module.exports = {
    // request information about an order
    findOrder: function (referenceNumber) {

        // these are not part of the Promise interface for the function.
        // these errors are to combat programmer error
        if (_.isFunction(arguments[1])) throw new TypeError('do not pass callback to findOrder. This function returns a Promise');
        if (!_.isString(referenceNumber)) throw new TypeError('missing first argument order id (String)');

        var body = ['<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
                        '<soap:Body>',
                            '<userLoginData xmlns="http://www.JOI.com/schemas/ViaSub.WMS/">',
                                '<ThreePLID>454</ThreePLID>',
                                '<Login>' + process.env.RL_USER + '</Login>' +
                                '<Password>' + process.env.RL_PASSWORD + '</Password>' +
                            '</userLoginData>',
                            '<focr xmlns="http://www.JOI.com/schemas/ViaSub.WMS/">',
                                '<CustomerID>12</CustomerID>',
                                '<FacilityID>1</FacilityID>',
                                '<OverAlloc>Any</OverAlloc>',
                                '<Closed>Any</Closed>',
                                '<ASNSent>Any</ASNSent>',
                                '<RouteSent>Any</RouteSent>',
                                '<ReferenceNum>' + referenceNumber + '</ReferenceNum>',
                            '</focr>',
                            '<limitCount xmlns="http://www.JOI.com/schemas/ViaSub.WMS/">1000</limitCount>',
                        '</soap:Body>',
                    '</soap:Envelope>'].join('');

        return _request('Find Order', body).then(function (json) {
            var info;
            var missingError;

            try { // order was found
                var order = json['soap:Envelope']['soap:Body'][0].FindOrders[0].orders[0].order[0];

                info = {
                    customerName: order.CustomerName[0],
                    customerEmail: order.CustomerEmail[0],
                    facility: order.Facility[0],
                    facilityId: order.FacilityID[0],
                    warehouseTransactionId: order.WarehouseTransactionID[0],
                    referenceNum: order.ReferenceNum[0],
                    poNum: order.PONum[0],
                    retailer: order.Retailer[0],
                    shipTo: {
                        company: order.ShipToCompanyName[0],
                        name: order.ShipToName[0],
                        email: order.ShipToEmail[0],
                        phone: order.ShipToPhone[0],
                        address1: order.ShipToAddress1[0],
                        address2: order.ShipToAddress2[0],
                        city: order.ShipToCity[0],
                        state: order.ShipToState[0],
                        zip: order.ShipToZip[0],
                        country: order.ShipToCountry[0]
                    },
                    processDate: order.ProcessDate[0], // YYYY-MM-DD
                    shippingMethod: order.ShipMethod[0],
                    creationDate: new Date(order.CreationDate[0]),
                    earliestShipDate: new Date(order.EarliestShipDate[0]),
                    shipCancelDate: new Date(order.ShipCancelDate[0]),
                    pickDate: new Date(order.PickTicketPrintDate[0]),
                    pickupDate: new Date(order.PickupDate[0]),
                    carrier: order.Carrier[0],
                    billingCode: order.BillingCode[0],
                    totalWeight: parseFloat(order.TotWeight[0], 10),
                    numPackages: parseInt(order.TotPackages[0], 10),
                    totalQuantity: parseInt(order.TotOrdQty[0]),
                    notes: order.Notes[0],
                    trackingNumber: order.TrackingNumber[0],
                    loadNumber: order.LoadNumber[0]
                };
            } catch (e) {
                try { // the order was not found
                    var totalOrders = json['soap:Envelope']['soap:Body'][0].totalOrders[0]._;
                    missingError = {error: 'found ' + totalOrders + ' orders with reference number ' + referenceNumber};
                    // cb(new Error('found ' + totalOrders + ' orders with reference number ' + referenceNumber));
                } catch (ev) { // something unexpected happened
                    console.log(e);
                    console.log(JSON.stringify(json, null, 2));
                    missingError = {error: 'failed to find order with reference number ' + referenceNumber + '. ' + JSON.stringify(json)};
                }

            }

            return new Promise(function (resolve, reject) {
                if (missingError) return reject(missingError);
                else return resolve(info);
            });
        });
    },

    getInventory: function (cb) {
        var body = '<?xml version="1.0" encoding="utf-8"?>' +
            '<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">' +
                '<soap12:Body>' +
                    '<userLoginData xmlns="http://www.JOI.com/schemas/ViaSub.WMS/">' +
                        '<ThreePLID>454</ThreePLID>' +
                        '<Login>' + process.env.RL_USER + '</Login>' +
                        '<Password>' + process.env.RL_PASSWORD + '</Password>' +
                    '</userLoginData>' +
                '</soap12:Body>' +
            '</soap12:Envelope>';

        var info;
        var errorString;

        return _request('Inventory', body).then(function (json) {

            try {
                // wtf
                var data = json['soap:Envelope']['soap:Body'][0].string[0].MyDataSet[0].Q;

                info = data.reduce(function (memo, item) {
                    var sku = item.SKU[0];

                    if (sku.match(/test/)) return memo;

                    if (memo[sku] === undefined) {
                        memo[sku] = {
                            available: parseInt(item.SUMOFAVAILABLE, 10),
                            total: parseInt(item.SUMOFONHAND, 10),
                            allocated: parseInt(item.SUMOFALLOCATED, 10)
                        };
                    } else {
                        memo[sku].available += parseInt(item.SUMOFAVAILABLE, 10);
                        memo[sku].total += parseInt(item.SUMOFONHAND, 10);
                        memo[sku].allocated += parseInt(item.SUMOFALLOCATED, 10);
                    }

                    return memo;
                }, {});

            } catch (e) {
                errorString = JSON.stringify(e);
            }

            return new Promise(function (resolve, reject) {
                if (errorString) return reject(errorString);
                else return resolve(info);
            });
        });
    },

    cancelOrder: function (id, cb) {

    },

    updateOrder: function (id, update, cb) {

    },

    createItems: function (item, cb) {

    },


    /*
    * this method expects a special object, not a Mongoose Schema instance.

    {
        id: String,
        name: String,
        email: String,
        address_1: String,
        address_2: String,
        city: String,
        state: String,
        zip: String,
        country: String,
        shippingMode: String,
        skus: [{ // so bundles CANNOT be directly passed to order creation
            sku: String,
            quantity: Number
        }]
    }

    */
    createSingleOrder: function (order, cb) {
        // check if order object is a mongoose object

        // munges on the order object so that it will go through the RL api
        var o = validateOrder(order);

        var template = _.template(['<Order>\n',
            '<TransInfo>\n',
                '<ReferenceNum><%= id %></ReferenceNum>\n',
                '<PONum>1234</PONum>\n',
            '</TransInfo>\n',
            '<ShipTo>\n',
                '<Name><%= name %></Name>\n',
                '<CompanyName></CompanyName>\n',
                '<Address>\n',
                    '<Address1><%= address_1 %></Address1>\n',
                    '<Address2><%= address_2 %></Address2>\n',
                    '<City><%= city %></City>\n',
                    '<State><%= state %></State>\n',
                    '<Zip><%= zip %></Zip>\n',
                    '<Country><%= country %></Country>\n',
                '</Address>\n',
                '<PhoneNumber1></PhoneNumber1>\n',
                '<EmailAddress1><%= email %></EmailAddress1>\n',
                '<CustomerName><%= name %></CustomerName>\n',
            '</ShipTo>\n',
            '<ShippingInstructions>\n',
                '<Carrier>USPS</Carrier>\n',
                '<Mode><%= shippingMode %></Mode>\n',
                '<BillingCode>Prepaid</BillingCode>\n',
            '</ShippingInstructions>\n',
            '<OrderLineItems>\n',
                '<% _.each(skus, function (item) { %>',
                    '<OrderLineItem>',
                    '<SKU><%= item.sku %></SKU>',
                    '<Qualifier>None</Qualifier>',
                    '<Qty><%= item.quantity %></Qty>',
                    '</OrderLineItem>',
                '<% }); %>' +
            '</OrderLineItems>\n',
        '</Order>\n'].join('')
        );


        var body = ['<?xml version="1.0" encoding="utf-8"?>\n',
        '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\n',
            '<soap:Body>\n',
                '<extLoginData xmlns="http://www.JOI.com/schemas/ViaSub.WMS/">\n',
                    '<ThreePLKey>{' + process.env.THREE_PL_KEY + '}</ThreePLKey>\n', // this was a number from the docs. unique to us?
                    '<Login>' + process.env.RL_USER + '</Login>',
                    '<Password>' + process.env.RL_PASSWORD + '</Password>',
                    '<FacilityID>1</FacilityID>\n',
                '</extLoginData>\n',
                '<orders xmlns="http://www.JOI.com/schemas/ViaSub.WMS/">\n',
                    template(o),
                '</orders>\n',
            '</soap:Body>\n',
        '</soap:Envelope>'].join('');

        var promise;
        var notCreated;
        var info;
        console.log('NODE_ENV', process.env.NODE_ENV);
        if (process.env.NODE_ENV !== 'production') {
            fs.writeFileSync('../tmp/body.xml', body);

            return new Promise(function (resolve, reject) {
                reject('orders must be sent to RL in production mode');
            });

        } else {
            return _request('Create Order', body).then(function (json) {
                try {
                    var processed = parseInt(json['soap:Envelope']['soap:Body'][0].Int32[0]._, 10);
                    info = {ordersCreated: processed, success: true, order: o};
                } catch (e) {
                    console.log(json);
                    notCreated = {
                        success: false,
                        ordersCreated: 0,
                        message: 'failed to process order via RL api',
                        json: json
                    };
                }

                return new Promise(function (resolve, reject) {
                    if (notCreated) return reject(notCreated);
                    return resolve(info);
                });
            });
        }
    }
};