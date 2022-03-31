# MoveVoiceMailToS3

## Motivation
Occasionally we run into situations where an oauth client needs a user context in order to function correctly.  In such
cases, a [Client Credential Oauth Grant](https://developer.genesys.cloud/authorization/platform-auth/use-client-credentials) 
won't work as it doesn't contain a user context.  However, that is the goto for developing server based or "unattended" 
processes that don't require user interaction.  At times these unattended processes need access to resources that 
require a user context. 

In this blueprint we are going to demonstrate how you can leverage an 
[Authorization Code Oauth Grant](https://developer.genesys.cloud/authorization/platform-auth/use-authorization-code)
to access API resources that require a user context in an unattended service.  Full disclosure, this is much more complicated  
than a Client Credential Grant as the access tokens need to be rotated on a regular basis.  Also, it is HIGHLY recommended 
that you don't use an end user for your grant.  If you do, and that end user is terminated or changes positions in 
someway, you are likely to want to either delete the account or change permissions which could break your backend 
process.  It is recommended that you use a "Service account".  There is no formal representation of a "Service account" 
in Genesys today, so we will need to use a full user account, but it is a user account that will not be used by a person 
for their work.  It will exist solely to provide access to the backend services.

## Overview
Accessing voicemail recordings API endpoints requires a user context.  We will demonstrate this functionality by moving 
newly created voicemails from Genesys to AWS S3.  While this is a simple use case, the principles here are transferable 
to other APIs that require a user context.  Do note, that without maintaining a per-user Authorization Code Grant Oauth 
Client, you will not be able to access direct dialed voicemails.  This example will only be dealing with queue based 
voicemails but could be extended to group based voice mails as well.

If you need a process to move direct dialed voicemails, it is recommended that you include that in another process that 
your agent must interact with and ideally already log into Genesys with.  This becomes an "attended" process and is a 
more typical approach for a process that uses an Authorization Code Grant.

//Arch diagram

As you can see we are going to leverage 2 lambdas.  The RefreshAuthToken Lambda will be responsible for rotating the 
secret and will be triggered by AWS Secrets manager, and it's rotation schedule. The MoveVoicemailToS3 will be 
responsible for downloading the voicemail and uploading it to your S3 bucket in your AWS account.  From there, you can
take whatever action you need on the voicemail.  The MoveVoicemailToS3 lambda will be triggered by the
[VoicemailEndEvent](https://developer.genesys.cloud/analyticsdatamanagement/analytics/detail/analytics-detail-events#voicemailendevent)
that will be sent over the AWS EventBridge.

### Additional Resources
* [AWS Lambda](https://aws.amazon.com/lambda/)
* [AWS EventBridge](https://aws.amazon.com/eventbridge/)
* [Genesys Cloud Event Bridge Overview](https://developer.genesys.cloud/notificationsalerts/notifications/event-bridge)
* [Genesys Oauth Overview](https://developer.genesys.cloud/authorization/platform-auth/)
* [Authorization Code Oauth Grant](https://developer.genesys.cloud/authorization/platform-auth/use-authorization-code)
