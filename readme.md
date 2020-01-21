Store sensor metric data in cloud
=================================

This is yet another hobby project to play with serverless implementations. The project is splitted in two separate node.js modules as follows.

| Module / Element | Platform | Purpose |
| ------ | -------- | ------- |
| ifDataGet | Google Cloud Functions | Retrieve metrics from Google Datastore and output as json array to be displayed as chart on a web page |
| ifDataPut | Raspberry Pi | Retrieve sensor metics and store them in Google Cloud Datastore. Also periodically calculate daily summaries from old data to reduce stored entries. |
| static html | Google Cloud Storage | Hosting of the static web page html code that is used to render

Original inspiration was to fetch and store temperature and other environmental data collected from [RuuviTag](https://ruuvi.com). In absence of RuuviTag, interface counter data was used instead as those were easily available from [ER-X](https://www.ui.com/edgemax/edgerouter-x/).

Project enables extremely cost efficient (practically free of charge) method to store and display sensor metric data with only inexpensive, small and energy conserving device to collect sensor metrics.

## Demo site

http://misc.karilaalo.fi/ifDataDemo/

## Authentication

Access to cloud function is restricted by authentication. To gain simplicity, [Google Sign-In for Websites](https://developers.google.com/identity/sign-in/web) is used. Other Sign-In methods would be available as well with used architectural design.

As the static website is hosted from separate domain from the cloud function serving the data, CORS requirements cause small obstacles for the authentication. Cloud Functions support Google authentication by themselves, but only when they are published from common domain.

To get around CORS requirements, Google Cloud Endpoints [Extensible Server proxy (ESP)](https://cloud.google.com/endpoints/docs/openapi/glossary#extensible_service_proxy) is used to protect the function with authentication. ESP is deployed as [Cloud Run](https://cloud.google.com/run/) container.

The authentication information about the user is relayed to the function using OIDC ID Token that is received from the Google Sing-In OpenID Connect Provider. Short-lived ID Token is sufficient as it is needed only at the time the chart data is fetched. It is supposed that Google Sign-In client libraries handle refreshing of the ID Token when necessary.

This makes very inexpensive compination of services as the container reserves computing instances only when used. In single user scenario, the container instance is spawned only so often.

## Data visualisation

Visualisation of the sensor metrics data is provided by [Chart.js](https://www.chartjs.org) javascript charting library.

## Architecture

Implementation relies on following services and devices. List may be incomplete:

* [Raspberry Pi](https://www.raspberrypi.org)
* [Google Cloud Functions](https://cloud.google.com/functions/)
* [Google Cloud Endpoints](https://cloud.google.com/endpoints/)
* [Google Cloud Datastore](https://cloud.google.com/datastore/)
* [Google Cloud Storage](https://cloud.google.com/storage/)
* [Node.js 10](https://nodejs.org/)
* [Chart.js](https://www.chartjs.org)

![Architecture layout illustration](ifDataArch.svg?raw=true)


## Deploy

Deploy ifDataGet function to cloud:

    gcloud functions deploy ifDataGet --runtime nodejs10 --update-env-vars A_USER=12345 --trigger-http --memory 128MB --region europe-west1

ESP deployment to the Cloud Run container (_beta_) is somewhat more complex. Please refer to [https://cloud.google.com/endpoints/docs/openapi/get-started-cloud-run](tutorial).
