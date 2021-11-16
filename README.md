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
    
    
    <img src='https://static.node.iopulsedev.net/nodes/Scheduler_Config.png' alt='manage palette' height="250">
    <img src='https://static.node.iopulsedev.net/nodes/Scheduler_Config_help.png' alt='manage palette' height="250">

### Installing the client library


To install the stable version use the Menu - Manage palette option and search for node-red-contrib-scheduler, or run the following command in your Node-RED user directory - typically ~/.node-red: 

        npm install node-red-contrib-scheduler

Or else install the package directly from Manage Palette

Restart your Node-RED instance and you should have a "Scheduler" node available in the palette.

## Get Started


<p>1. After installation, drag the <b>scheduler</b> node from the palette to the workspace.</p>
<p>2. Double click on the node to add timer.</p>


## Usage

<p>With Scheduler node you can set up your flows to be executed at defined times or regular intervals. The scheduler node work as a cron job for your flows.</p>

<p>Each scheduler node requires a publicly accessible URL where the flow will be deployed and will be used by the Google Cloud scheduler to send to a target according to a specified schedule.</p> 

<p>It is important to note that the target must be HTTP/S endpoints.</p>

<p>To test the scheduler node in a local environment, developer can either</p>
<p>1. Utilize tools like ngrok to accept HTTP traffic</p>
<p>2. Export their flows & import them to Krysp platform (built using Node-RED).</p>


## Discussions and suggestions

Use the Krysp Forum: https://www.krysp.io/forum to ask questions or to discuss new features.

[projects]: https://console.cloud.google.com/project
[enable_api]: https://console.cloud.google.com/flows/enableapi?apiid=cloudscheduler.googleapis.com
[auth]: https://cloud.google.com/docs/authentication/getting-started
