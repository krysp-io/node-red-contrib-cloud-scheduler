# node-red-contrib-cloud-scheduler

This module provides a **Scheduler Task Start** node in Node-RED for executing any flow at a given time interval using Google Cloud Scheduler. It allows you to run the flows at the same time each week, day, or hour with guaranteed execution and retries in case of failures.

Scheduler Task Start node will retry to execute the flow in the case of error or failure, with a minimum backoff value of 5s to maximum backoff value of 1h.

# Pre-requisites

1. The scheduler node requires Node-RED to be installed.
2. The Node-RED should be accessible from internet.
3. [Select or create a Cloud Platform project][projects].
4. [Enable the Google Cloud Scheduler API][enable_api].
5. [Set up authentication with a service account][auth] so you can access the API from your local workstation.
    
## Setup Google Cloud Scheduler and Google Credentials

Cloud Scheduler node uses Google Cloud Scheduler to execute the flow. GCP credentials are required to securely create a scheduler task in Google Cloud Scheduler. Use the scheduler node's configuration to provide GCP credentials.  

If Node-RED is running under a GCP environment such as a Compute Engine, Google Kubernetes Engine or Cloud Run then there is an implicit identity presented to GCP and the flow developer need not provide any authentication configuration.  However, if your Node-RED runtime is not running under GCP or you wish to call a service with a distinct identity, then you will need to use explicit credentials.

Credentials can be provided either as a path to a named key file or by creating a Node-RED managed name credentials secret.  Each credential defined as a Node-RED secret has the following properties:


| Property    | Type     | Description                                          |
| ----------- | -------- | ---------------------------------------------------- |
| **name**    | `string` | Label for easy identification, essentially a comment. |
| **account** | `string` | Credentials in the form of a JSON key.               |

The credentials for a service account can be acquired from the [APIs & Services](https://console.cloud.google.com/apis/credentials) menu. After you finish creating a service account key, it will be downloaded in JSON format and saved to a local file.

<img src="https://static.node.iopulsedev.net/nodes/credentials1.png" width="350" />

<img src="https://static.node.iopulsedev.net/nodes/credentials2.png" width="650" />

<img src="https://static.node.iopulsedev.net/nodes/credentials3.png" width="450" />

# Install

To install the stable version use the **Menu - Manage palette** option and search for node-red-contrib-cloud-scheduler, or run the following command in your Node-RED user directory - typically ~/.node-red: 

> npm install node-red-contrib-cloud-scheduler

Or else install the package directly from **Manage Palette**

Restart your Node-RED instance and you should have a **Schedule Task node** node available in the palette.

# Get Started

After installing the mapper node, follow the below steps:

1. Drag the **Scheduler Task Start** node from the palette to the workspace. 
<img src='https://static.node.iopulsedev.net/nodes/Scheduler.png' alt='config_help' width="200" />

2. Double click to open the Config node.
<img src='https://static.node.iopulsedev.net/nodes/Scheduler_completed_form.png' alt='config_help' width="350" />

3. To add Click on the edit icon to **Add Google Cloud Credentials** in the config node. (*Copy and paste the contents of the Google service account credential JSON file [created above](#setup-google-cloud-scheduler-and-google-credentials), directly into the **Key** field.*)
<img src='https://static.node.iopulsedev.net/nodes/scheduler_google_credentials.png' alt='config_help' width="300" />

4. Click **Add** to save the credentials.
5. The **URL** field will be auto-populated based on the browser URL. **It is important to note that this URL should be accessible via internet for scheduler to execute the flow**.
6. Attach Scheduler Task Start node infront of any new or already existing flow.
<img src='https://static.node.iopulsedev.net/nodes/Scheduler_Flow.png' alt='config_help' width="800" />


# Usage

With Scheduler node you can set up your flows to be executed at defined times or regular intervals. **The scheduler node work as a cron job for your flows**.

Run your batch and big data jobs on a recurring schedule to make them more reliable and reduce manual toil. Instead of using poorly written scripts or human intervention to run large jobs, **Cloud Scheduler allows you to run them at the same time each week, day, or hour with guaranteed execution and retries in case of failures**.

**Important Note**: Each scheduler node **requires a publicly accessible URL** where the flow will be deployed and will be used by the Google Cloud scheduler to send to a target according to a specified schedule.

It is also important to note that the target must be HTTP/S endpoints.

To test the scheduler node in a local environment, developer can either
1. Utilize tools like ngrok to accept HTTP traffic
2. Export their flows & import them to [Krysp](https://www.krysp.io/) platform (built on Node-RED).

The **Repeat** field, defines the schedule for the Google Cloud Scheduler to invoke and execute the flow. The schedule can be as follows:

 1. **Every minute**
 2. **Hourly**
 3. **Daily** *(at a specific time or at a certain frequency between time interval)*
 4. **Weekly** *(at a specific time or at a certain frequency between time interval)*
 5. **Monthly** *(on a specific day, for a date range or all days, at a specific time or at a certain frequency between time interval)*

The node also provides a way to know the selected schedule in a readable format for better understanding.

# FAQs

 - [How does cloud-scheduler work?](#how-does-cloud-scheduler-work) 
 - [Do I have to create a Google Cloud account?](#do-i-have-to-create-a-google-cloud-account) 
 - [How to get google-cloud-credentials?](#how-to-get-google-cloud-credentials) 
 - [How to add google-cloud-credentials?](#how-to-add-google-cloud-credentials) 
 - [What should be the method (POST/PUT)?](#what-should-be-the-method-postput)
 - [What is the URL?](#what-is-the-url)
 - [Is it mandatory to have a publicly accessible URL?](#is-it-mandatory-to-have-a-publicly-accessible-url)
 - [If I am having problems and unable to troubleshoot what should I do?](#if-i-am-having-problems-and-unable-to-troubleshoot-what-should-i-do)

## How does cloud-scheduler work?
Cloud Scheduler is a fully manged cron job scheduler. It allows you to scheduler any job for executing the flow.

## Do I have to create a Google Cloud account?
Yes, you've to create a Google Cloud account and create a new project for Google Cloud Scheduler to work. Please follow the guide here to continue.

## How to get google-cloud-credentials?
Please follow the guide here to create Google Cloud credentials.

## How to add google-cloud-credentials?
Drag and Open the scheduler node. Click on the edit icon to **Add Google Cloud Credentials** in the config node. (*Copy and paste the contents of the Google service account credential JSON file [created above](#setup-google-cloud-scheduler-and-google-credentials), directly into the **Key** field.*)

## What should be the method (Post/Put)?
Cloud Scheduler will use POST method by default. PUT method can be used for updating any job. 

## What is the URL?
Cloud Scheduler will create the URL from the URL entered in the field in combination with node id.

## Is it mandatory to have a publicly accessible URL?
Yes. It is important that the URL is publicly accessible for Google Cloud Scheduler to execute the flow.

## If I am having problems and unable to troubleshoot what should I do?
If you're still not able to execute your flow using the scheduler, please send an email with a subject line **Cloud Scheduler Issue** at developer@krysp.io. Please describe your issue and attach your flow, logs (optional), and screenshots if possible.

# Node-RED On Cloud

If you're looking for a Node-RED solution on cloud, try https://www.krysp.io/.

 - Krysp platform is **built on Node-RED**
 - **Quick Start Templates** for different use cases.
 - Flow execution metrics for analysis
 - Enhanced log viewer that shows application and system logs
 - Multi-user capabilities

# Contributions

Development of Cloud Scheduler Node happens in the open on GitHub, and we are grateful to the community for contributing bugfixes and improvements. Read below to learn how you can take part in improving mapper node.

## Contributing Guide

Read our contributing guide to learn about our development process, how to propose bugfixes and improvements.

## Discussions and suggestions

Use the Krysp Forum: https://www.krysp.io/forum to ask questions or to discuss new features.

[projects]: https://console.cloud.google.com/project
[enable_api]: https://console.cloud.google.com/flows/enableapi?apiid=cloudscheduler.googleapis.com
[auth]: https://cloud.google.com/docs/authentication/getting-started30
