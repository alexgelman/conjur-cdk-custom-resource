import { Construct, CustomResource, Duration } from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import * as cr from '@aws-cdk/custom-resources';
import * as logs from '@aws-cdk/aws-logs';
import * as lambda from "@aws-cdk/aws-lambda";
import { PythonFunction } from "@aws-cdk/aws-lambda-python";
import * as ec2 from "@aws-cdk/aws-ec2"

export interface ConjurGetSecretsProps {
  iamRole: iam.IRole;
  conjurUrl: string;
  authnIamServiceID: string;
  conjurAuthnLogin: string;
  conjurAccount: string;
  ignoreSsl: boolean;
  secretIDs: string;
  vpc?: ec2.IVpc;
  subnets?: ec2.ISubnet[];
  securityGroups?: ec2.ISecurityGroup[];
}

export class ConjurGetSecrets extends Construct {
  readonly Secrets: CustomResource;

  constructor(scope: Construct, id: string, props: ConjurGetSecretsProps)
  {
    super(scope, id);


    const onEvent = new PythonFunction(this, 'GetConjurSeretsFunction', {
      entry: 'lib/lambda/',
      index: 'conjur-get.py',
      handler: 'lambda_handler',
      runtime: lambda.Runtime.PYTHON_3_8,
      environment: {
        CONJUR_URL: props.conjurUrl,
        AUTHN_IAM_SERVICE_ID: props.authnIamServiceID,
        CONJUR_AUTHN_LOGIN: props.conjurAuthnLogin,
        CONJUR_ACCOUNT: props.conjurAccount,
        IGNORE_SSL: String(props.ignoreSsl),
        SECRET_IDS: props.secretIDs
      },
      role: props.iamRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnets: props.subnets
      },
      securityGroups: props.securityGroups,
      allowPublicSubnet: true,
      timeout: Duration.seconds(30)
    });

    const lambdaRole = new iam.Role(this, 'CRProviderRole', { 
        roleName: 'ConjurCRProviderRole',
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies: [
            iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaVPCAccessExecutionRole")
        ]
     });
    const crProvider = new cr.Provider(this, 'ConjurCRProvider', {
      onEventHandler: onEvent,      // optional async "waiter"
      logRetention: logs.RetentionDays.ONE_DAY,   // default is INFINITE
      role: lambdaRole, // must be assumable by the `lambda.amazonaws.com` service principal
      vpc: props.vpc,
      vpcSubnets: {
        subnets: props.subnets
      },
      securityGroups: props.securityGroups,
    });

    this.Secrets = new CustomResource(this, 'ConjurGetSecretsCR', { serviceToken: crProvider.serviceToken })
  }

}
