const platformClient = require('purecloud-platform-client-v2');
const { SecretsManagerClient, GetSecretValueCommand, PutSecretValueCommand,
    DescribeSecretCommand,
    UpdateSecretVersionStageCommand
} = require("@aws-sdk/client-secrets-manager");

const AWSCloudRegion = process.env.AWS_CLOUD_REGION;
const secretManagerClient = new SecretsManagerClient({region: AWSCloudRegion});

exports.handler = async (event) => {
    console.log(`Incoming event: ${JSON.stringify(event)}`);

    const arn = event.SecretId;
    const token = event.ClientRequestToken;

    const step = event.Step;
    if (step === "createSecret") {
        console.log("createSecret step sent");
        await createSecret(arn, token);
    } else if (step === "setSecret") {
        console.log("setSecret step sent.  This step allows us to set the secret in the corresponding system." +
            "Since we are fetching the secret from Genesys Cloud, we do not need to \"set\" the secret.  Skipping step.");
    } else if (step === "testSecret") {
        console.log("testSecret step sent");
        await testSecret(arn);
    } else if (step === "finishSecret") {
        console.log("finishSecret step sent");
        await finishSecret(arn, token);
    }
};
async function createSecret(arn, token) {
    try {
        //ResourceNotFoundException is thrown if the pending secret doesn't exist
        await getPendingSecret(arn);
    }catch (err) {
        if(err.name === 'ResourceNotFoundException'){
            console.log("Pending secret does not exist.  We can move forward.");
        } else {
            console.log("Pending secret does exist, skipping new secret creation.");
            return;
        }
    }
    try {
        const newSecretVal = await getNewSecret(arn);

        const putSecretCommand = new PutSecretValueCommand({
            SecretId: arn,
            ClientRequestToken: token,
            SecretString: JSON.stringify(newSecretVal),
            VersionStages: ['AWSPENDING']
        });
        await secretManagerClient.send(putSecretCommand);
        console.log("Pending secret created successfully!");
    } catch (err) {
        logStepFailure(arn, "Create", err);
        throw err;
    }
}
async function getNewSecret(arn){
    //get current secret value.
    const currentSecret = await getCurrentSecret(arn);
    const currentSecretVal = JSON.parse(currentSecret.SecretString);

    //Create the Genesys Cloud client
    const gcClient = platformClient.ApiClient.instance;
    const gcAuthData = await gcClient.refreshCodeAuthorizationGrant(currentSecretVal.clientId, currentSecretVal.clientSecret, currentSecretVal.refreshToken);
    const newSecretVal = {
        "clientId": currentSecretVal.clientId,
        "clientSecret": currentSecretVal.clientSecret,
        "accessToken": gcAuthData.accessToken,
        "refreshToken": gcAuthData.refreshToken
    };
    return newSecretVal;
}
async function testSecret(arn) {
    try {
        const pendingSecret = await getPendingSecret(arn);
        const secretValue = JSON.parse(pendingSecret.SecretString);

        //Create the Genesys Cloud client
        const gcClient = platformClient.ApiClient.instance;
        gcClient.setAccessToken(secretValue.accessToken);
        const userAPI = new platformClient.UsersApi();

        const user = await userAPI.getUsersMe();
        if(user){
            console.log(`test was successful. User: ${JSON.stringify(user)}`);
        }else{
            throw {
                name: "UserNotFoundException",
                errorMessage: `Unable to find the user for clientId: ${secretValue.clientId} for the pending secret`
            };
        }
    } catch (err) {
        logStepFailure(arn, "Test", err);
        throw err;
    }
}
async function finishSecret(arn, token) {
    try {
        const secretMeta = await describeSecret(arn);
        let currentVersion;
        for(const versionId in secretMeta.VersionIdsToStages) {
            if ("AWSCURRENT" === secretMeta.VersionIdsToStages[versionId][0]) {
                if (versionId === token) {
                    console.log(`Version ${versionId} is already the AWSCURRENT for arn: ${arn}. Returning as the secret already rotated.`);
                    return;
                }
                currentVersion = versionId;
            }
        }

        //update the pending secret to the current
        const updateSecretVersionCommand = new UpdateSecretVersionStageCommand(
            {
                SecretId: arn,
                VersionStage: "AWSCURRENT",
                MoveToVersionId: token,
                RemoveFromVersionId: currentVersion
            }
        );

        await secretManagerClient.send(updateSecretVersionCommand);
        console.log(`Version ${currentVersion} is now the AWSCURRENT for arn: ${arn}`);
    } catch (err) {
        logStepFailure(arn, "Finish", err);
        throw err;
    }
}
async function describeSecret(arn){
    const secretCommand = new DescribeSecretCommand({SecretId: arn});
    const secret = await secretManagerClient.send(secretCommand);
    return secret;
}
async function getSecretByStage(arn, stage) {
    const getSecretValCommand = new GetSecretValueCommand({SecretId: arn, VersionStage: stage});
    const secretVal = await secretManagerClient.send(getSecretValCommand);
    return secretVal;
}
async function getCurrentSecret(arn){
    return await getSecretByStage(arn, "AWSCURRENT");
}
async function getPendingSecret(arn){
    return await getSecretByStage(arn, "AWSPENDING");
}
function logStepFailure(step, arn, err) {
    console.error(`Secret Rotation Failed in the ${step} Step for arn: ${arn}. Error: ${JSON.stringify(err)}`);
}
