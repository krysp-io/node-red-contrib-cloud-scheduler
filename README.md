## node-red-contrib-scheduler
A node that allows to execute any flow at a given time interval.


## Pre-requisites

<p>1 The Node-RED Scheduler node requires Node-RED to be installed.</p>
<p>2. The Node-RED should be accessible from internet.</p>

## Quickstart

### Before you begin

1.  [Select or create a Cloud Platform project][projects].
1.  [Enable the Google Cloud Scheduler API][enable_api].
1.  [Set up authentication with a service account][auth] so you can access the
    API from your local workstation.

### Installing the client library


To install the stable version use the Menu - Manage palette option and search for node-red-contrib-scheduler, or run the following command in your Node-RED user directory - typically ~/.node-red: 

        npm install node-red-contrib-scheduler

Or else install the package directly from Manage Palette

Restart your Node-RED instance and you should have a "Scheduler" node available in the palette.

## Get Started


<p>1. After installation, drag the <b>scheduler</b> node from the palette to the workspace.</p>
<p>2. Double click on the node to add timer.</p>


## Usage

The scheduler node can be utilized in any flow to execute the flow at a given time interval.

Note: This node does not send any response to the request. The flow must include an HTTP Response node to complete the request.

## Discussions and suggestions

Use the Krysp Forum: https://www.krysp.io/forum to ask questions or to discuss new features.

[projects]: https://console.cloud.google.com/project
[enable_api]: https://console.cloud.google.com/flows/enableapi?apiid=cloudscheduler.googleapis.com
[auth]: https://cloud.google.com/docs/authentication/getting-started
