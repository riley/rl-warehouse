var request = require('request');
var parseString = require('xml2js').parseString;

var soapActions = {
    'Find Order': "http://www.JOI.com/schemas/ViaSub.WMS/FindOrders",
    'Create Orders': "http://www.JOI.com/schemas/ViaSub.WMS/CreateOrders",
    'Create Order': "http://www.JOI.com/schemas/ViaSub.WMS/CreateOrders",
    'Inventory': "http://www.JOI.com/schemas/ViaSub.WMS/ReportStockStatus"
};

function _request (endpoint, body, cb) {

    var headers = {
        'Content-Type': 'text/xml; charset=utf-8',
        'Host': 'app02.3plcentral.com'
    };

    headers.SOAPAction = soapActions[endpoint];

    request({
        url: 'https://app02.3plcentral.com/webserviceexternal/contracts.asmx',
        method: 'POST',
        headers: headers,
        body: body
    }, function (err, response, xml) {
        if (err) return cb(err);

        if (!response) return cb('missing response on endpoint ' + endpoint);

        // Riley Life returns invalid xml, good times.
        xml = xml.replace(/&lt;/g, '<');
        xml = xml.replace(/&gt;/g, '>');

        parseString(xml, cb);
    });
}

module.exports = {
    // request information about an order
    // refe
    findOrder: function (referenceNumber, cb) {
        var body = ['<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
                        '<soap:Body>',
                            '<userLoginData xmlns="http://www.JOI.com/schemas/ViaSub.WMS/">',
                                '<ThreePLID>454</ThreePLID>',
                                '<Login>' + process.env.RL_USER + '</Login>',
                                '<Password>' + process.env.RL_PASSWORD + '</Password>',
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

        _request('Find Order', body, function (err, json) {
            try {
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
                cb(e);
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

                cb(null, info);
            } catch (e) {
                console.log(e);
                process.exit();
                cb(e);
            }
        });
    },

    createOrders: function (orders, cb) {

    },

    createSingleOrder: function (order, cb) {

    }
};