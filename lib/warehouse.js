var Promise = require('bluebird');
var request = Promise.promisifyAll(require('request'));
var xml2js = Promise.promisifyAll(require('xml2js'));
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
    for (var field in order.shippingAddress) {
        order.shippingAddress[field] = order.shippingAddress[field].replace(/&/g, 'and');
    }

    order.shippingAddress.country = countriesMap[order.shippingAddress.country];

    if (order.shippingAddress.country === 'United States' && order.shippingAddress.state.trim().match(/^dc/i)) {
        order.shippingAddress.state = 'District of Columbia';
    }

    var shippingMode = null;
    if (order.shipping.free === true) {
        var isUS = (order.shippingAddress.country === 'United States');

        shippingMode = (isUS && order.actualWeight > 1 || !isUS && order.actualWeight > 4) ? 'Priority Mail' : 'First Class Mail';
    } else {
        shippingMode = order.shipping.service;
    }

    if (order.shipping.domestic !== true) {
        shippingMode = order.shipping.service;
    }

    order.shippingMode = shippingMode;
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
        return cb('trying to send orders to live RL server.');
    }

    return request.postAsync(requestParams).spread(function (response, xmlString) {
        xmlString = xmlString.replace(/&lt;/g, '<');
        xmlString = xmlString.replace(/&gt;/g, '>');
        return xml2js.parseStringAsync(xmlString);
    });

    // request.postAsync(requestParams, function (err, response, xml) {
    //     if (err) return cb(JSON.stringify(err, null, 2));

    //     if (!response) return cb('missing response on endpoint ' + endpoint);

    //     // Riley Life returns invalid xml, good times.
    //     xml = xml.replace(/&lt;/g, '<');
    //     xml = xml.replace(/&gt;/g, '>');

    //     if (process.env.NODE_ENV !== 'production') console.log(xml);

    //     parseString(xml, cb);
    // });
}

module.exports = {
    // request information about an order
    // refe
    findOrder: function (referenceNumber, cb) {
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

        _request('Find Order', body).then(function (data) {
            console.log('data', data);
            process.exit();
        });

        if (true) return;

        _request('Find Order', body, function (err, json) {
            if (err) return cb(err);

            try { // order was found
                var order = json['soap:Envelope']['soap:Body'][0].FindOrders[0].orders[0].order[0];

                var info = {
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

                cb(null, info);
            } catch (e) {
                try { // the order was not found
                    var totalOrders = json['soap:Envelope']['soap:Body'][0].totalOrders[0]._;
                    cb(new Error('found ' + totalOrders + ' orders with reference number ' + referenceNumber));
                } catch (ev) { // something unexpected happened
                    console.log(e);
                    console.log(JSON.stringify(json, null, 2));
                    cb('failed to find order with reference number ' + referenceNumber + '. ' + JSON.stringify(json));
                }

            }
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

        _request('Inventory', body, function (err, json) {
            if (err) return cb(err);

            try {
                // wtf
                var data = json['soap:Envelope']['soap:Body'][0].string[0].MyDataSet[0].Q;

                var info = data.reduce(function (memo, item) {
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

                if (_.isFunction(cb)) {
                    cb(null, info);
                }
            } catch (e) {
                console.log(e);
                cb(e);
            }
        });
    },

    cancelOrder: function (id, cb) {

    },

    updateOrder: function (id, update, cb) {

    },

    createItems: function (item, cb) {

    },

    createSingleOrder: function (order, cb) {
        // check if order object is a mongoose object

        if (order.constructor.name === 'model') {
            // it's a mongoose object
            order = order.toObject();
        }

        // munges on the order object so that it will go through the RL api
        validateOrder(order);

        var template = _.template(['<Order>\n',
            '<TransInfo>\n',
                '<ReferenceNum><%= _id.valueOf() %></ReferenceNum>\n',
                '<PONum>1234</PONum>\n',
            '</TransInfo>\n',
            '<ShipTo>\n',
                '<Name><%= shippingAddress.name %></Name>\n',
                '<CompanyName></CompanyName>\n',
                '<Address>\n',
                    '<Address1><%= shippingAddress.address_1 %></Address1>\n',
                    '<Address2><%= shippingAddress.address_2 %></Address2>\n',
                    '<City><%= shippingAddress.city %></City>\n',
                    '<State><%= shippingAddress.state %></State>\n',
                    '<Zip><%= shippingAddress.zip %></Zip>\n',
                    '<Country><%= shippingAddress.country %></Country>\n',
                '</Address>\n',
                '<PhoneNumber1></PhoneNumber1>\n',
                '<EmailAddress1><%= email %></EmailAddress1>\n',
                '<CustomerName><%= billingAddress.name %></CustomerName>\n',
            '</ShipTo>\n',
            '<ShippingInstructions>\n',
                '<Carrier>USPS</Carrier>\n',
                '<Mode><%= shippingMode %></Mode>\n',
                '<BillingCode>Prepaid</BillingCode>\n',
            '</ShippingInstructions>\n',
            '<OrderLineItems>\n',
                '<% _.each(bundles, function (bundle) { %>',
                    '<% _.each(bundle.skus, function (item) { %>',
                        '<OrderLineItem>',
                        '<SKU><%= item.sku %></SKU>',
                        '<Qualifier>None</Qualifier>',
                        '<Qty><%= item.quantity %></Qty>',
                        '</OrderLineItem>',
                    '<% }); %>' +
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
                    template(order),
                '</orders>\n',
            '</soap:Body>\n',
        '</soap:Envelope>'].join('');



        if (process.env.NODE_ENV !== 'production') {
            console.log(body);

            setTimeout(function () {
                cb();
            }, 2000);

        } else {
            _request('Create Order', function (err, json) {
                if (err) return cb(err);

                try {
                    var processed = parseInt(json['soap:Envelope']['soap:Body'][0].Int32[0]._, 10);

                    return cb(null, {ordersCreated: processed, success: true}, order);
                } catch (e) {
                    return cb({
                        success: false,
                        ordersCreated: 0,
                        message: 'failed to process order in RL api',
                        json: json
                    });
                }
            });
        }
    }
};