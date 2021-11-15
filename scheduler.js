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


    const rawBodyParser = (req, res, next) => {
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
        }, (err, buf) => {
            if (err) { return next(err); }
            if (!isText && checkUTF && isUtf8(buf)) {
                buf = buf.toString()
            }
            req.body = buf;
            next();
        });
    }

    var corsSetup = false;

    const createResponseWrapper = (node, res) => {
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
        toWrap.forEach((f) => {
            wrapper[f] = () => {
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

    var corsHandler = (req, res, next) => { next(); }

    if (RED.settings.httpNodeCors) {
        corsHandler = cors(RED.settings.httpNodeCors);
        RED.httpNode.options("*", corsHandler);
    }




    function SchedulerNode(n) {
        RED.nodes.createNode(this, n);

        console.log("===========");
        console.log(RED);
        console.log("===========");



        this.repeat = n.repeat;
        this.crontab = n.crontab;
        this.once = n.once;
        this.onceDelay = (n.onceDelay || 0.1) * 1000;
        this.interval_id = null;
        this.cronjob = null;
        this.method = n.method;
        this.name = null;
        var node = this;
        this.url = n.url;
        this.not_publicly_accessible = n.not_publicly_accessible;
        var pattern = /localhost|127.0.0.1/gi;
        let credentials = null;

        if (n.account) {
            credentials = GetCredentials(n.account);
        }

        function GetCredentials(node) {
            return JSON.parse(RED.nodes.getCredentials(node).account);
        }

        if (!n.url) {
            this.warn(RED._("Missing Path."));
            return;
        } else if (pattern.test(this.url)) {
            this.warn(RED._("Localhost is not supported."));
            return;
        } else if (!this.not_publicly_accessible) {
            this.warn(RED._("Mandatory:Please click on the checkbox if this URL is publicly accessible."));
            return;
        } else if (!credentials) {
            this.warn(RED._("Google Cloud Credentials are required."));
            return;
        }

        const SchedulerHttpIn = () => {

            if (RED.settings.httpNodeRoot !== false) {


                var node = this;

                this.errorHandler = (err, req, res, next) => {
                    node.warn(err);
                    res.sendStatus(500);
                };

                this.callback = (req, res) => {
                    console.log("called");
                    var msgid = RED.util.generateId();
                    res._msgid = msgid;
                    if (node.method.match(/^(post|delete|put|options|patch)$/)) {
                        node.send({ _msgid: msgid, req: req, res: createResponseWrapper(node, res), payload: req.body });
                    } else if (this.method == "get") {
                        node.send({ _msgid: msgid, req: req, res: createResponseWrapper(node, res), payload: req.query });
                    } else {
                        node.send({ _msgid: msgid, req: req, res: createResponseWrapper(node, res) });
                    }
                };

                var httpMiddleware = (req, res, next) => { next(); }

                if (RED.settings.httpNodeMiddleware) {
                    if (typeof RED.settings.httpNodeMiddleware === "function" || Array.isArray(RED.settings.httpNodeMiddleware)) {
                        httpMiddleware = RED.settings.httpNodeMiddleware;
                    }
                }

                var maxApiRequestSize = RED.settings.apiMaxLength || '5mb';
                var jsonParser = bodyParser.json({ limit: maxApiRequestSize });
                var urlencParser = bodyParser.urlencoded({ limit: maxApiRequestSize, extended: true });

                var metricsHandler = (req, res, next) => { next(); }
                if (this.metric()) {
                    metricsHandler = (req, res, next) => {
                        var startAt = process.hrtime();
                        onHeaders(res, () => {
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

                var multipartParser = (req, res, next) => { next(); }

                const getUrl = (path) => {
                    var url = null;
                    var removeDoubleSlashFromUrl = path.split('//');
                    if (removeDoubleSlashFromUrl.length === 1) {
                        url = removeDoubleSlashFromUrl[0][0] === '/' ? removeDoubleSlashFromUrl[0] : `/${removeDoubleSlashFromUrl[0]}`
                        return url
                    } else {
                        var getPathOfUrl = removeDoubleSlashFromUrl[1].split('/');
                        getPathOfUrl.shift();
                        console.log(getPathOfUrl);
                        var buildUrlStr = getPathOfUrl.join('/');
                        console.log(buildUrlStr);
                        return `/${buildUrlStr}`
                    }
                }


                if (this.method == "get") {
                    RED.httpNode.get(getUrl(this.url), cookieParser(), httpMiddleware, corsHandler, metricsHandler, this.callback, this.errorHandler);
                } else if (this.method == "post") {
                    RED.httpNode.post(getUrl(this.url), cookieParser(), httpMiddleware, corsHandler, metricsHandler, jsonParser, urlencParser, multipartParser, rawBodyParser, this.callback, this.errorHandler);
                } else if (this.method == "put") {
                    RED.httpNode.put(getUrl(this.url), cookieParser(), httpMiddleware, corsHandler, metricsHandler, jsonParser, urlencParser, rawBodyParser, this.callback, this.errorHandler);
                } else if (this.method == "patch") {
                    RED.httpNode.patch(getUrl(this.url), cookieParser(), httpMiddleware, corsHandler, metricsHandler, jsonParser, urlencParser, rawBodyParser, this.callback, this.errorHandler);
                } else if (this.method == "delete") {
                    RED.httpNode.delete(getUrl(this.url), cookieParser(), httpMiddleware, corsHandler, metricsHandler, jsonParser, urlencParser, rawBodyParser, this.callback, this.errorHandler);
                }
                this.on("close",() => {
                    var node = this;
                    RED.httpNode._router.stack.forEach((route,i,routes) => {
                        if (route.route && route.route.path === getUrl(this.url) && route.route.methods[node.method]) {
                            routes.splice(i,1);
                        }
                    });
                });


            } else {
                this.warn(RED._("httpin.errors.not-created"));
            }
        }

        SchedulerHttpIn();


        // Create a client.
        const client = new scheduler.CloudSchedulerClient({
            credentials: credentials
        });

        // Construct the fully qualified location path.
        const parent = client.locationPath(credentials.project_id, "us-east1");

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


                this.name = n.id;
                const job = {
                    name: `projects/${credentials.project_id}/locations/us-east1/jobs/${this.name}`,
                    httpTarget: {
                        uri: this.url,
                        httpMethod: this.method,
                        body: { "message": "Scheduled job executed via Google Cloud Scheduler" }
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
                    // const [response] = await client.createJob(request);
                    // this.cronjob = response;
                } catch (err) {
                    // console.log("cloud scheduler err", err)
                    // this.log(RED._(err.message));
                    // const [response] = await client.updateJob(request);
                    // this.cronjob = response;
                }
            }
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
                console.log("-------------------------");
                console.log('msg', msg);
                console.log('----------------------');
                send(msg);
                done();
            }
        });

        // this.on("close", async function() {
        //     console.log("===================");
        //     console.log("calles");
        //     console.log("===================");

        //     var node = this;
        //     if (this.onceTimeout) {
        //         clearTimeout(this.onceTimeout);
        //     }
        //     if (this.interval_id != null) {
        //         clearInterval(this.interval_id);
        //         if (RED.settings.verbose) { this.log(RED._("inject.stopped")); }
        //     } else if (this.cronjob != null) {
        //         // Construct the fully qualified location path.

        //         const job = client.jobPath(credentials.project_id, "us-east1", this.name);
        //         // Use the client to send the job creation request.
        //         await client.deleteJob({ name: job });

        //         if (RED.settings.verbose) { this.log(RED._("inject.stopped")); }

        //         delete this.cronjob;
        //     }
        //     RED.httpNode._router.stack.forEach(function(route,i,routes) {
        //         if (route.route && route.route.path === node.url && route.route.methods[node.method]) {
        //             routes.splice(i,1);
        //         }
        //     });
        // })
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



