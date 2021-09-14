import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2'
import * as iam from '@aws-cdk/aws-iam'
import * as lambda from '@aws-cdk/aws-lambda'
import {ConjurGetSecrets} from '../lib/index'

export class ConjurGetStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
    
        const conjur = new ConjurGetSecrets(this, "ConjurExampleCR", {
                conjurUrl: "<Conjur instance address>",
                authnIamServiceID: "<Service ID in Conjur>",
                conjurAuthnLogin: "<IAM role host in Conjur for IAM authentication>",
                conjurAccount: "<Conjur account>",
                ignoreSsl: true,
                secretIDs: "<List of Conjur variable IDs delimited by ;>", // example: myUsername;myPassword
                vpc: ec2.Vpc.fromLookup(this, "lambda-VPC", {
                        vpcId: "<VPC where the custom resource will run>" // Conjur instance need to be accesible from this VPC
                }),
                subnets: [ec2.Subnet.fromSubnetId(this, "lambda-subnet", "<Subnet where the custom resource will run>")], // has to be a private subnet due to a bug in cdk
                securityGroups: [ec2.SecurityGroup.fromSecurityGroupId(this, "vpc-sg", "<Security group for the custom resource>")], // needs to allow communication with the Conjur instance and STS service
                iamRole: iam.Role.fromRoleArn(this, "get-from-conjur-role", "<ARN for the custom resource lambda role>") // must match the same role in conjurAuthnLogin
        })


        new lambda.Function(this, "TestFunction", {
            runtime: lambda.Runtime.NODEJS_12_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
                exports.handler = async (event) => {
                    console.log('event: ', event)
                };
            `),
            environment: {
                // Example of using the secrets retrieved by Conjur, myUsername and myPassword were secret IDs provided in secretIDs above
                'Username': conjur.Secrets.getAttString("myUsername"),
                'Password': conjur.Secrets.getAttString("myPassword"),
            },
        });
    }
}

const app = new cdk.App();
new ConjurGetStack(app, "ConjurGetSecretsExample", { 
    env: { 
      account: process.env.CDK_DEFAULT_ACCOUNT, 
      region: process.env.CDK_DEFAULT_REGION 
  }})
app.synth();