## node-red-contrib-cloud-scheduler
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


To install the stable version use the Menu - Manage palette option and search for node-red-contrib-cloud-scheduler, or run the following command in your Node-RED user directory - typically ~/.node-red: 

        npm install node-red-contrib-cloud-scheduler

Or else install the package directly from Manage Palette

Restart your Node-RED instance and you should have a "Scheduler" node available in the palette.

### Get Started


<p>1. After installation, drag the <b>scheduler</b> node from the palette to the workspace.</p>
<p align="center"> <img src='https://static.node.iopulsedev.net/nodes/Scheduler_Node.png' alt='config_help' width="200" height="80" /></p>
<p>2. Double click on the node.</p>
<p>3. Enter all the form fields in scheduler node and then click on Done</p>
<p> <img src='https://static.node.iopulsedev.net/nodes/Scheduler_completed_form.png' alt='config_help' width="350" height="450" /></p>
<p>4. Attach a Http Response and a debug node to scheduler node.</p>
<p> <img src='https://static.node.iopulsedev.net/nodes/Scheduler_HTTP_Debug.png' alt='config_help' width="300" height="100" /></p>
<p>5.Click on <img src="https://static.node.iopulsedev.net/nodes/deploy_to_cloud.png" width="300" height="50" /></p>
<p>6. At the scheduled time the flow will get executed.</p>
<img src="https://static.node.iopulsedev.net/nodes/Scheduler_Ouput.png" width="900" height="450" /></p>

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
[auth]: https://cloud.google.com/docs/authentication/getting-started30
    

