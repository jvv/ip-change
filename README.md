# IP Change

"Dynamic" DNS with AWS Route53. Will check your external IP address against a locally cached known externap IP address (`@todo - create this file on first run`)

## Installation

1. Clone the repo
2. `npm install`
3. Copy `.env.example` to `.env`
4. Fill out the `.env` file
5. Add your current external IP address to `ip.json`  (Step will be obsolete someday)
6. Set a cron job to run every x minutes

| dotEnv key | dotEnv value|
---- | ---- |
|AWS_ACCESS_KEY=|Your aws access key|
|AWS_SECRET_KEY=|Your aws secret key|
|AWS_REGION=|The AWS region you use the most, not really need for this though|
|AWS_HOSTED_ZONE_NAME=|The name of the hosted zone you want to check against (note the ending "." in AWS)|
|AWS_RECORD_NAME=|The record name you want your external IP to be attached to (note the ending "." in AWS)|
|MQTT_ADDRESS=|The MQ address you'll update messages to|
|MQTT_TOPIC=|The MQ topic you're listening against|
