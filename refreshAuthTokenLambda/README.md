# RefreshAuthTokenLambda

This Lambda is triggered by the AWS Secrets rotation scheduler.  It is written generically so this same Lambda can be 
reused across any Genesys Cloud Authorization Code Grant credentials.

### Setup
* Go to AWS Lambda
* Click "Create Lambda"
  * Give it a name
  * Select Node.js 14.x in the Runtime
  * Leave the rest of the defaults
  * Click "Create function"
* Click the "Configuration" tab
  * On the "General configuration" tab set the timeout to 1 minute.  This is arbitrarily long, 3 seconds is probably long 
enough most times but if something takes a bit we don't want to fail.
  * Click the Permissions tab
    * Click on the execution role.  This will take you to the IAM page.
      * Click on the Policy.  This will take you to the page to manage the policy for this role.
        * You will want to edit the policy and add the following permissions:
          * "secretsmanager:DescribeSecret"
          * "secretsmanager:PutSecretValue"
          * "secretsmanager:CreateSecret"
          * "secretsmanager:ListSecretVersionIds"
          * "secretsmanager:UpdateSecret"
          * "secretsmanager:GetSecretValue"
          * "secretsmanager:UpdateSecretVersionStage"
        * Specify the ARN for your Secret or a pattern that will match your Secret's ARN
        * You can and should leave the permission for the logs.
        * Review the Policy and Save the changes
    * Back on the Lambda scroll down to the "Resource-based policy" section and click "Add permissions"
      * Select "AWS Service"
      * Select "Secrets Manage" for the service
      * Select "lambda:InvokeFunction" for the action
      * Click save
