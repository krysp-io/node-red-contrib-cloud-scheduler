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

    const getUrl = (path) => {
        var url = null;
        var removeDoubleSlashFromUrl = path.split('//');
        if (removeDoubleSlashFromUrl.length === 1) {
            url = removeDoubleSlashFromUrl[0][0] === '/' ? removeDoubleSlashFromUrl[0] : `/${removeDoubleSlashFromUrl[0]}`
            return url
        } else {
            var getPathOfUrl = removeDoubleSlashFromUrl[1].split('/');
            getPathOfUrl.shift();
            var buildUrlStr = getPathOfUrl.join('/');
            return `/${buildUrlStr}`
        }
    }

    function SchedulerHTTPIn(n) {
        RED.nodes.createNode(this, n);
        if (RED.settings.httpNodeRoot !== false) {

            if (!n.url) {
                this.warn(RED._("httpin.errors.missing-path"));
                return;
            }
            this.url = n.url;
            var pattern = /^http:|https:/;
            var checkForLocalhost = /localhost|127.0.0.1/gi;
            if (this.url[0] !== '/' && !pattern.test(this.url)) {
                this.url = '/' + this.url;
            }
            this.method = n.method;
            this.upload = n.upload;
            this.swaggerDoc = n.swaggerDoc;
            this.crontab = n.crontab;
            let credentials = null;
            let buildUrl = getUrl(this.url);
            this.jobCreated = false;
            this.not_publicly_accessible = n.not_publicly_accessible;

            var node = this;

            this.on("close", async function (removed, done) {
                var node = this;
                if (removed) {
                    const job = client.jobPath(credentials.project_id, "us-east1", this.id);
                    await client.deleteJob({ name: job });
                } else {
                    this.jobCreated = false;
                    RED.httpNode._router.stack.forEach(async function (route, i, routes) {
                        if (route.route && route.route.path === buildUrl && route.route.methods[node.method]) {
                            routes.splice(i, 1);
                        }
                    });
                }
                done()
            });

            if (n.account) {
                credentials = GetCredentials(n.account);
            }

            function GetCredentials(node) {
                return JSON.parse(RED.nodes.getCredentials(node).account);
            }

            if (!credentials) {
                this.warn(RED._("Missing Google Cloud Credentials"));
                return;
            }
            // if (checkForLocalhost.test(this.url)) {
            //     this.warn(RED._("Localhost is not supported."));
            //     return;
            // } 
            if (!this.not_publicly_accessible) {
                this.warn(RED._("Mandatory:Please click on the checkbox if this URL is publicly accessible."));
                return;
            }


            // Create a client.
            const client = new scheduler.CloudSchedulerClient({
                credentials: credentials
            });

            // Construct the fully qualified location path.
            const parent = client.locationPath(credentials.project_id, "us-east1");

            const jobName = client.jobPath(credentials.project_id, "us-east1", this.id);
            const job = {
                name: jobName,
                httpTarget: {
                    uri: this.url,
                    httpMethod: this.method,
                    body: { "name": "Scheduled job executed via Google Cloud Scheduler" }
                },
                schedule: this.crontab,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            };

            const request = {
                parent: parent,
                job: job,
            };
            client.getJob({ name: jobName }).then(exists => {
                client.updateJob(request).then(updated => node.emit("input", {})).catch(err => {
                    this.warn(exists);
                })
            }).catch(err => {
                client.createJob(request).then(created => node.emit("input", {})).catch(err => {
                    this.warn(err);
                })
            })




            this.on("input", HTTPIn);


            function HTTPIn(msg, send, done) {
                this.errorHandler = function (err, req, res, next) {
                    node.warn(err);
                    res.sendStatus(500);
                };

                this.callback = async function (req, res) {
                    var msgid = RED.util.generateId();
                    res._msgid = msgid;
                    if (node.method.match(/^(post|delete|put|options|patch)$/)) {
                        node.send({ _msgid: msgid, req: req, res: createResponseWrapper(node, res), payload: req.body });
                    } else if (node.method == "get") {
                        node.send({ _msgid: msgid, req: req, res: createResponseWrapper(node, res), payload: req.query });
                    } else {
                        node.send({ _msgid: msgid, req: req, res: createResponseWrapper(node, res) });
                    }
                    done()
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


                if (this.method == "get") {
                    RED.httpNode.get(buildUrl, cookieParser(), httpMiddleware, corsHandler, metricsHandler, this.callback, this.errorHandler);
                } else if (this.method == "post") {
                    RED.httpNode.post(buildUrl, cookieParser(), httpMiddleware, corsHandler, metricsHandler, jsonParser, urlencParser, multipartParser, rawBodyParser, this.callback, this.errorHandler);
                } else if (this.method == "put") {
                    RED.httpNode.put(buildUrl, cookieParser(), httpMiddleware, corsHandler, metricsHandler, jsonParser, urlencParser, rawBodyParser, this.callback, this.errorHandler);
                } else if (this.method == "patch") {
                    RED.httpNode.patch(buildUrl, cookieParser(), httpMiddleware, corsHandler, metricsHandler, jsonParser, urlencParser, rawBodyParser, this.callback, this.errorHandler);
                } else if (this.method == "delete") {
                    RED.httpNode.delete(buildUrl, cookieParser(), httpMiddleware, corsHandler, metricsHandler, jsonParser, urlencParser, rawBodyParser, this.callback, this.errorHandler);
                }
            }

        } else {
            this.warn(RED._("httpin.errors.not-created"));
        }
    }
    RED.nodes.registerType("Scheduler", SchedulerHTTPIn);
}



