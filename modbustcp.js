
module.exports = function (RED) {
    var RED  = require(process.env.NODE_RED_HOME + "/red/red"),
        http = require("http");   

    // Config Node
    function ConfigNode(config) {
        RED.nodes.createNode(this, config);
        this.host       = config.host;
        this.port       = config.port;
        this.unit_id    = config.unit_id;
        this.servPort   = config.restful; // web service
    }

    // Modbus Write Node
    function ModbusTCPWrite(config) {
        RED.nodes.createNode(this, config);
        
        var node        = this
        ,   configNode  = RED.nodes.getNode(config.server)
        ,   data        = {}
        ,   options     = {}

        data = {
            "server": {
                "host": configNode.host,
                "port": configNode.port,
                "id": Number(configNode.unit_id)
            },
            "payload": {
                "address": Number(config.adr)
                //data.payload.data = Number(msg.payload);
            }
        };

        switch (config.dataType) {
            case "Coil": //FC: 5
                node.querystring = "/mb/tcp/5";                        
                break;
            case "HoldingRegister": //FC: 6
                node.querystring = "/mb/tcp/6";                               
                break
        }

        options = {
            hostname:   "127.0.0.1",
            port:       configNode.servPort,
            path:       node.querystring,
            method:     "POST",
            headers:    {'Content-Type': 'application/json',}
        };
        
        node.on("input", function (msg) { 
            if (!(msg && msg.hasOwnProperty('payload'))) return;
            if (msg.payload == null) {
                node.error('Invalid msg.payload!');
                return;
            }

            data.payload.data = Number(msg.payload);
            
            var req = http.request(options, function(res) {
                res.setEncoding('utf8');
                // got http response
                res.on("data", function (body) {
                    //console.log(body);
                    try { msg.payload = JSON.parse(body); }
                    catch(e) { node.warn("request error"); }
                    if (msg.payload.status == "ok") {
                        node.status({ fill: "green", shape: "dot", text: "write" });
                        setTimeout(function() { node.status({}); }, 300);
                    } else {
                        node.status({ fill: "red", shape: "dot", text: msg.payload.status });
                        return;
                    }
                });
            });

            // SEND HTTP POST
            req.write(JSON.stringify(data));
            //console.log(JSON.stringify(data));
            req.end();

            // HTTP POST error
            req.on("error", function(err) {
                console.log(err);
                node.status({ fill: "red", shape: "ring", text: "backend error" });
            });
        });
    }
    
    // Modbus Read Node
    function ModbusTCPRead(config) {
        RED.nodes.createNode(this, config);
        
        var timerID
        ,   configNode  = RED.nodes.getNode(config.server)
        ,   node        = this
        ,   options     = {}
        ,   msg         = { "topic": config.name }
        ,   data        = {}
        
        data = {
            "server": {
                "host": configNode.host,
                "port": configNode.port,
                "id": Number(configNode.unit_id)
            },
            "payload": {
                "address": Number(config.adr),
                "data": Number(config.quantity)
            }
        };

        switch (config.dataType) {
            case "Coil":            //FC: 1
                node.querystring = "/mb/tcp/1";                        
                break;
            case "Input":           //FC: 2
                node.querystring = "/mb/tcp/2";                               
                break
            case "HoldingRegister": //FC: 3
                node.querystring = "/mb/tcp/3";                        
                break;
            case "InputRegister":   //FC: 4
                node.querystring = "/mb/tcp/4";                               
                break
        }

        options = {
            hostname:   "127.0.0.1",
            port:       configNode.servPort,
            path:       node.querystring,
            method:     "POST",
            headers:    {'Content-Type': 'application/json',}
        };

        tcpMaster(); //fire once at start

        timerID = setInterval(function(){                 
            tcpMaster();
        }, config.rate * 1000);

        function tcpMaster() {
            var req = http.request(options, function(res) {
                res.setEncoding('utf8');
                // got http response
                res.on("data", function (body) {
                    try { 
                        msg.payload = JSON.parse(body); 
                    }
                    catch(e) { 
                        node.warn("request error"); 
                    }
                    if (msg.payload.status == "ok") {
                        msg.payload = msg.payload.data;
                        node.send(msg);
                        node.status({ fill: "green", shape: "dot", text: "read" });
                        setTimeout(function(){ node.status({});}, 300);
                    } else {
                        msg.payload = msg.payload.status;
                        node.send(msg);
                        node.status({ fill:"red", shape:"dot", text: msg.payload });
                        return;
                    }
                });
            });

            // SEND HTTP POST
            req.write(JSON.stringify(data));
            //console.log(JSON.stringify(data));
            req.end();

            // HTTP POST error
            req.on("error", function(err) {
                console.log(err);
                node.status({fill:"red", shape:"ring", text: "backend error"});
            });
        }

        node.on("close", function () {
            clearInterval(timerID); // disable setinterval
        });
    }
    
    // Register nodes
    RED.nodes.registerType("mbtcp-server",  ConfigNode);
    RED.nodes.registerType("mbtcp-write",   ModbusTCPWrite);
    RED.nodes.registerType("mbtcp-read",    ModbusTCPRead);
}