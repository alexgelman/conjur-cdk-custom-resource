# Conjur CDK Custom Resource

An example of a CDK construct that retreives secrets from a Conjur instance so that they could be referenced by other resources in the same stack.

The class `ConjurGetSecrets` implements a CDK construct the creates a CloudFormation custom resource that uses a lambda function to retreive secrets from a Conjur instance during stack creation or update.

Check out the file `bin/conjur-example.ts` for a usage example, you must replace the arguments for the `ConjurGetSecrets` constructor with values that are valid in your AWS account.

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `cdk deploy`      deploy the stack to your aws account