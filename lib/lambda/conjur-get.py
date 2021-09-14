import os
import hashlib
import json
import urllib.parse
import boto3
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
import requests

session = boto3.Session()
credentials = session.get_credentials()
creds = credentials.get_frozen_credentials()

def lambda_handler(event, context):
    request_type = event['RequestType']
    if request_type != 'Create' and request_type != 'Update':
        return {
        "Status": "SUCCESS",
        "PhysicalResourceId": "CyberArk-Conjur-Get-Secrets-Resource",
        "StackId": event["StackId"],
        "RequestId": event["RequestId"],
        "LogicalResourceId": event["LogicalResourceId"],
        "NoEcho": True
    }

    request = AWSRequest("GET", "https://sts.amazonaws.com/?Action=GetCallerIdentity&Version=2011-06-15")
    payload_hash = hashlib.sha256(('').encode('utf-8')).hexdigest()
    request.headers.add_header("Host", "sts.amazonaws.com")
    request.headers.add_header("X-Amz-Content-sha256", payload_hash)
    request.headers.add_header("Accept-Encoding", "identity")
    request.headers.add_header("Content-Type", "application/x-www-form-urlencoded")
    SigV4Auth(creds, "sts", "us-east-1").add_auth(request)
    headers = {key: value for (key, value) in request.headers.items()}

    conjur_url = os.environ["CONJUR_URL"]
    host_id = urllib.parse.quote(os.environ["CONJUR_AUTHN_LOGIN"], safe='')
    service_id = os.environ["AUTHN_IAM_SERVICE_ID"]
    account = os.environ["CONJUR_ACCOUNT"]
    url = f"{conjur_url}/authn-iam/{service_id}/{account}/{host_id}/authenticate"
    use_ssl = not os.getenv("IGNORE_SSL", 'False').lower() in ('true', '1', 't')
    
    auth_res = requests.post(url, json.dumps(headers), headers={
            'Accept-Encoding': "base64"
        }, verify=use_ssl, timeout=5)
    conjur_token = auth_res.text

    print(f"Get conjur token: {auth_res.status_code}:{auth_res.reason}")
    if auth_res.status_code != 200:
        raise Exception(f"Authentication failure: {auth_res.status_code}:{auth_res.reason}")

    secret_ids = os.environ["SECRET_IDS"].split(";")
    secrets = {}
    for id in secret_ids:
        res = requests.get(f"{conjur_url}/secrets/{account}/variable/{id}", headers={
                'Authorization': f"Token token=\"{conjur_token}\""
            }, verify=use_ssl, timeout=5)
        
        if res.status_code != 200:
            raise Exception(f"Failed to get secret {id}. {res.status_code}:{res.reason}")
        secrets[id] = res.text

    response = {
        "Status": "SUCCESS",
        "PhysicalResourceId": "CyberArk-Conjur-Get-Secrets-Resource",
        "StackId": event["StackId"],
        "RequestId": event["RequestId"],
        "LogicalResourceId": event["LogicalResourceId"],
        "NoEcho": True,
        "Data": secrets
    }

    return response
