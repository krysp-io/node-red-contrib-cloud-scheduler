/**
 * Copyright JS Foundation and other contributors, http://js.foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function (RED) {
    "use strict";
    var bodyParser = require("body-parser");
    var multer = require("multer");
    var cookieParser = require("cookie-parser");
    var getBody = require('raw-body');
    var cors = require('cors');
    var onHeaders = require('on-headers');
    var typer = require('content-type');
    var mediaTyper = require('media-typer');
    var isUtf8 = require('is-utf8');
    var hashSum = require("hash-sum");

    const scheduler = require('@google-cloud/scheduler');


    function rawBodyParser(req, res, next) {
        if (req.skipRawBodyParser) { next(); } // don't parse this if told to skip
        if (req._body) { return next(); }
        req.body = "";
        req._body = true;

        var isText = true;
        var checkUTF = false;

        if (req.headers['content-type']) {
            var contentType = typer.parse(req.headers['content-type'])
            if (contentType.type) {
                var parsedType = mediaTyper.parse(contentType.type);
                if (parsedType.type === "text") {
                    isText = true;
                } else if (parsedType.subtype === "xml" || parsedType.suffix === "xml") {
                    isText = true;
                } else if (parsedType.type !== "application") {
                    isText = false;
                } else if ((parsedType.subtype !== "octet-stream")
                    && (parsedType.subtype !== "cbor")
                    && (parsedType.subtype !== "x-protobuf")) {
                    checkUTF = true;
                } else {
                    // application/octet-stream or application/cbor
                    isText = false;
                }

            }
        }

        getBody(req, {
            length: req.headers['content-length'],
            encoding: isText ? "utf8" : null
        }, function (err, buf) {
            if (err) { return next(err); }
            if (!isText && checkUTF && isUtf8(buf)) {
                buf = buf.toString()
            }
            req.body = buf;
            next();
        });
    }

    var corsSetup = false;

    function createResponseWrapper(node, res) {
        var wrapper = {
            _res: res
        };
        var toWrap = [
            "append",
            "attachment",
            "cookie",
            "clearCookie",
            "download",
            "end",
            "format",
            "get",
            "json",
            "jsonp",
            "links",
            "location",
            "redirect",
            "render",
            "send",
            "sendfile",
            "sendFile",
            "sendStatus",
            "set",
            "status",
            "type",
            "vary"
        ];
        toWrap.forEach(function (f) {
            wrapper[f] = function () {
                node.warn(RED._("httpin.errors.deprecated-call", { method: "msg.res." + f }));
                var result = res[f].apply(res, arguments);
                if (result === res) {
                    return wrapper;
                } else {
                    return result;
                }
            }
        });
        return wrapper;
    }

    var corsHandler = function (req, res, next) { next(); }

    if (RED.settings.httpNodeCors) {
        corsHandler = cors(RED.settings.httpNodeCors);
        RED.httpNode.options("*", corsHandler);
    }




    function InjectNode(n) {
        RED.nodes.createNode(this, n);


        this.repeat = n.repeat;
        this.crontab = n.crontab;
        this.projectId = n.projectId;
        this.once = n.once;
        this.onceDelay = (n.onceDelay || 0.1) * 1000;
        this.interval_id = null;
        this.cronjob = null;
        this.method = n.method;
        this.name = null;
        var node = this;
        this.url = n.url;

        let credentials = null;
        if (config.account) {
            credentials = GetCredentials(config.account);
        }

        // Create a client.
        const client = new scheduler.CloudSchedulerClient({
            credentials: credentials
        });

        // Construct the fully qualified location path.
        const parent = client.locationPath(this.projectId, "us-east1");

        function GetCredentials(node) {
            return JSON.parse(RED.nodes.getCredentials(node).account);
        }

        if (this.url[0] !== '/') {
            this.url = '/' + this.url;
        }



        if (node.repeat > 2147483) {
            node.error(RED._("inject.errors.toolong", this));
            delete node.repeat;
        }

        node.repeaterSetup = async function () {
            if (this.repeat && !isNaN(this.repeat) && this.repeat > 0) {
                this.repeat = this.repeat * 1000;
                if (RED.settings.verbose) {
                    this.log(RED._("inject.repeat", this));
                }
                this.interval_id = setInterval(function () {
                    node.emit("input", {});
                }, this.repeat);
            } else if (this.crontab) {
                if (RED.settings.verbose) {
                    this.log(RED._("inject.crontab", this));
                }

                this.name = n.id + process.env.KRYSP_NAMESPACE;
                const job = {
                    name: `projects/ace-bucksaw-299016/locations/us-east1/jobs/${this.name}`,
                    httpTarget: {
                        uri: `${window.location.origin}${this.url}`,
                        httpMethod: this.method,
                        body: Buffer.from('Hello World'),
                    },
                    schedule: this.crontab,
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                };

                const request = {
                    parent: parent,
                    job: job,

                };

                // Use the client to send the job creation request.

                try {
                    const [response] = await client.createJob(request);
                    this.cronjob = response;
                } catch (err) {
                    const [response] = await client.updateJob(request);
                    this.cronjob = response;
                }
            }
        }


        var node = this;

        this.errorHandler = function (err, req, res, next) {
            node.warn(err);
            res.sendStatus(500);
        };


        this.callback = function (req, res) {
            var msgid = RED.util.generateId();
            res._msgid = msgid;
            if (node.method.match(/^(post|delete|put|options|patch)$/)) {
                node.send(req.body);
                res.sendStatus(200);
                // node.send({ _msgid: msgid, req: req, res: createResponseWrapper(node, res), payload: req.body });
            } else if (node.method == "get") {
                node.send({ _msgid: msgid, req: req, res: createResponseWrapper(node, res), payload: req.query });
            } else {
                node.send({ _msgid: msgid, req: req, res: createResponseWrapper(node, res) });
            }
        };

        var httpMiddleware = function (req, res, next) { next(); }

        if (RED.settings.httpNodeMiddleware) {
            if (typeof RED.settings.httpNodeMiddleware === "function" || Array.isArray(RED.settings.httpNodeMiddleware)) {
                httpMiddleware = RED.settings.httpNodeMiddleware;
            }
        }

        var maxApiRequestSize = RED.settings.apiMaxLength || '5mb';
        var jsonParser = bodyParser.json({ limit: maxApiRequestSize });
        var urlencParser = bodyParser.urlencoded({ limit: maxApiRequestSize, extended: true });

        var metricsHandler = function (req, res, next) { next(); }
        if (this.metric()) {
            metricsHandler = function (req, res, next) {
                var startAt = process.hrtime();
                onHeaders(res, function () {
                    if (res._msgid) {
                        var diff = process.hrtime(startAt);
                        var ms = diff[0] * 1e3 + diff[1] * 1e-6;
                        var metricResponseTime = ms.toFixed(3);
                        var metricContentLength = res.getHeader("content-length");
                        //assuming that _id has been set for res._metrics in HttpOut node!
                        node.metric("response.time.millis", { _msgid: res._msgid }, metricResponseTime);
                        node.metric("response.content-length.bytes", { _msgid: res._msgid }, metricContentLength);
                    }
                });
                next();
            };
        }

        var multipartParser = function (req, res, next) { next(); }
        if (this.upload) {
            var mp = multer({ storage: multer.memoryStorage() }).any();
            multipartParser = function (req, res, next) {
                mp(req, res, function (err) {
                    req._body = true;
                    next(err);
                })
            };
        }

        if (this.method == "post") {
            RED.httpNode.post(this.url, cookieParser(), httpMiddleware, corsHandler, metricsHandler, jsonParser, urlencParser, multipartParser, rawBodyParser, this.callback, this.errorHandler);
        } else if (this.method == "put") {
            RED.httpNode.put(this.url, cookieParser(), httpMiddleware, corsHandler, metricsHandler, jsonParser, urlencParser, rawBodyParser, this.callback, this.errorHandler);
        } else if (this.method == "patch") {
            RED.httpNode.patch(this.url, cookieParser(), httpMiddleware, corsHandler, metricsHandler, jsonParser, urlencParser, rawBodyParser, this.callback, this.errorHandler);
        }


        // Construct the request body.


        if (this.once) {
            this.onceTimeout = setTimeout(function () {
                node.emit("input", {});
                node.repeaterSetup();
            }, this.onceDelay);
        } else {
            node.repeaterSetup();
        }
        this.on("input", function (msg, send, done) {
            var errors = [];

            if (errors.length) {
                done(errors.join('; '));
            } else {
                send(msg);
                done();
            }
        });

        this.on("close", async function() {
            if (this.onceTimeout) {
                clearTimeout(this.onceTimeout);
            }
            if (this.interval_id != null) {
                clearInterval(this.interval_id);
                if (RED.settings.verbose) { this.log(RED._("inject.stopped")); }
            } else if (this.cronjob != null) {
                // Construct the fully qualified location path.
    
                const job = client.jobPath("ace-bucksaw-299016", "us-east1", this.name);
                // Use the client to send the job creation request.
                await client.deleteJob({ name: job });
    
                if (RED.settings.verbose) { this.log(RED._("inject.stopped")); }
    
                delete this.cronjob;
            }
        })
    }

    RED.nodes.registerType("Scheduler", SchedulerNode);

    RED.httpAdmin.post("/inject/:id", RED.auth.needsPermission("inject.write"), async function (req, res) {
        var node = RED.nodes.getNode(req.params.id);
        if (node != null) {
            try {
                if (req.body && req.body.__user_inject_props__) {
                    node.receive(req.body);
                } else {
                    node.receive();
                }
                res.sendStatus(200);
            } catch (err) {
                res.sendStatus(500);
                node.error(RED._("inject.failed", { error: err.toString() }));
            }
        } else {
            res.sendStatus(404);
        }
    });
}



