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
    const { google } = require('googleapis');
    const cloudscheduler = google.cloudscheduler('v1');


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


            this.url = n.url;
            var pattern = /^http:|https:/;
            var checkForLocalhost = /localhost|127.0.0.1/gi;
            if (this.url[0] !== '/' && !pattern.test(this.url)) {
                this.url = '/' + this.url;
            }
            this.method = n.method;
            this.upload = n.upload;
            this.crontab = n.crontab;
            var credentials = null;
            var buildUrl = getUrl(this.url);
            this.not_publicly_accessible = n.not_publicly_accessible;
            this.name = n.name;
            var node = this;
            this.jobName = null;
            this.parent = null;
            this.location = null;
            this.job = {};
            this.request = {};
            this.checkForSpaceInName = this.name.split(" ");

            if (this.checkForSpaceInName.length > 1) {
                this.name = this.checkForSpaceInName.join('_')
            }
 
            if (n.account) {
                credentials = GetCredentials(n.account);
            }

            function GetCredentials(node) {
                return JSON.parse(RED.nodes.getCredentials(node).account);
            }


            // Create a client.
            const client = new scheduler.CloudSchedulerClient({
                credentials: credentials
            });


            if (credentials) {
                (async () => {


                    const authClient = await authorize();
                    const request = {
                        name: `projects/${credentials.project_id}`,
                        auth: authClient,
                    };

                    try {
                        const response = (await cloudscheduler.projects.locations.list(request)).data;
                        this.location = response.locations[0].locationId;
                        this.jobName = client.jobPath(credentials.project_id, this.location, this.id);
                        this.parent = client.locationPath(credentials.project_id, this.location);
                        if (!n.url) {
                            this.completeRemove();
                            this.warn("Mandatory : Missing URL Path. Please provide publicly accessible URL in the scheduler node.");
                            return;
                        }
                        if (!credentials) {
                            this.removeHttpIN();
                            this.warn("Mandatory : Missing Google Cloud Credentials. Add Credentials by clicking on the edit icon in the scheduler node.");
                            return;
                        }
                        if (checkForLocalhost.test(this.url)) {
                                this.completeRemove();
                                this.warn("Localhost is not supported. Please provide publicly accessible for google cloud scheduler to create the job.");
                                return;
                        }
                        if (!this.not_publicly_accessible) {
                            this.completeRemove();
                            this.warn(`Mandatory : Please click on the checkbox in the scheduler node to verify that the URL is publicly accessible for google cloud scheduler to create the job.`);
                            return;
                        }

                        this.init();
                    } catch (err) {
                        this.warn(err)
                    }
                })()


                async function authorize() {
                    const auth = new google.auth.GoogleAuth({
                        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
                        credentials
                    });
                    return await auth.getClient();
                }
            }




            this.createJob = async () => {
                try {
                    await client.createJob(this.request);
                    this.warn(`Google Cloud Scheduler successfully created on ${this.url} for cron : ${this.crontab}`);
                    node.emit("input", {});
                } catch (err) {
                    this.warn(err)
                }
            }

            this.updateJob = async () => {
                try {
                    await client.updateJob(this.request);
                    this.warn(`Google Cloud Scheduler successfully updated on ${this.url} for cron : ${this.crontab}`);
                    node.emit("input", {});
                } catch (err) {
                    this.warn(err)
                }
            }

            this.removeJob = async () => {
                client.getJob({ name: this.jobName }).then(async exists => {
                    await client.deleteJob({ name: this.jobName });
                }).catch(err => this.trace(err))
            }

            this.removeHttpIN = () => {
                var node = this;
                RED.httpNode._router.stack.forEach(async function (route, i, routes) {
                    const matchedRouteIndex = routes.findIndex(val => {
                        const { params } = val;
                        if (params) {
                            return params.id === n.id;
                        }
                    });
                    if (matchedRouteIndex >= 0) {
                        routes.splice(matchedRouteIndex, 1)
                    }

                });
            }

            this.completeRemove = () => {
                this.removeHttpIN();
                this.removeJob();
            }

            this.init = () => {
                this.job = {
                    name: this.jobName,
                    httpTarget: {
                        uri: `${this.url}/${n.id}`,
                        httpMethod: this.method,
                        body: Buffer.from("Scheduled job executed via Google Cloud Scheduler")
                    },
                    schedule: this.crontab,
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                };

                this.request = {
                    parent: this.parent,
                    job: this.job,
                };
                client.getJob({ name: this.jobName }).then(exists => {
                    this.removeHttpIN();
                    this.debug(JSON.stringify(exists))
                    this.updateJob();
                }).catch(err => this.createJob())
            }

            this.on("close", (removed, done) => {
                if (removed) {
                    this.completeRemove()
                }
                done()
            });




            function HTTPIn(msg, send, done) {
                this.errorHandler = function (err, req, res, next) {
                    node.warn(err);
                    res.sendStatus(500);
                };

                this.callback = function (req, res) {
                    var msgid = RED.util.generateId();
                    res._msgid = msgid;
                    if (node.method.match(/^(post|delete|put|options|patch)$/)) {
                        node.send({ _msgid: msgid, req: req, res: createResponseWrapper(node, res), payload: req.body.toString() });
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
                    RED.httpNode.get(`${buildUrl}/:id`, cookieParser(), httpMiddleware, corsHandler, metricsHandler, this.callback, this.errorHandler);
                } else if (this.method == "post") {
                    RED.httpNode.post(`${buildUrl}/:id`, cookieParser(), httpMiddleware, corsHandler, metricsHandler, jsonParser, urlencParser, multipartParser, rawBodyParser, this.callback, this.errorHandler);
                } else if (this.method == "put") {
                    RED.httpNode.put(`${buildUrl}/:id`, cookieParser(), httpMiddleware, corsHandler, metricsHandler, jsonParser, urlencParser, rawBodyParser, this.callback, this.errorHandler);
                } else if (this.method == "patch") {
                    RED.httpNode.patch(`${buildUrl}/:id`, cookieParser(), httpMiddleware, corsHandler, metricsHandler, jsonParser, urlencParser, rawBodyParser, this.callback, this.errorHandler);
                } else if (this.method == "delete") {
                    RED.httpNode.delete(`${buildUrl}/:id`, cookieParser(), httpMiddleware, corsHandler, metricsHandler, jsonParser, urlencParser, rawBodyParser, this.callback, this.errorHandler);
                }
            }

            node.on("input", HTTPIn)


        } else {
            this.warn(RED._("httpin.errors.not-created"));
        }
    }
    RED.nodes.registerType("Scheduler Request", SchedulerHTTPIn);
}


