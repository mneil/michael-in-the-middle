# Michael In The Middle (MITT) Proxy

Michael in the middle is a man in the middle proxy for AWS. Why? That sounds scary, oh no. But...

Have you ever wanted to grant temporary (as short as you would like, 1 second? No problem) access to AWS without exposing any AWS credentials to the user / application. Michael In The Middle provides its own authentication scheme for connecting to the proxy. That auth is used to grant access to AWS on behalf of the client. Users never receive direct access to AWS.

## Quickstart

Clone the repository:

```sh
git clone git@github.com:mneil/michael-in-the-middle.git
cd michael-in-the-middle
```

Install the dependencies:

```sh
npm i
```

You need to set AWS credentials either in the environment, the EC2 metadata service, in your ~/.aws/credentials file first then run the proxy:

```sh
# Using the credentials ini file set a profile
export AWS_PROFILE=MyProfile
npm run start # authenticates now to AWS via the environment profile
# > aws-proxy@1.0.0 start
# > node ./src/index.js

# server is running 5465
```

In a new shell without AWS credentials set and no default profile use the proxy to get AWS Caller Identity

```sh
# set this file for tls verification to the proxy
export AWS_CA_BUNDLE=${PWD}/.http-mitm-proxy/certs/ca.pem
# set the HTTPS_PROXY variable. The AWS CLI supports this and will use a proxy
export HTTPS_PROXY=http://localhost:5465
aws sts get-caller-identity
```

You should receive a response with information about `MyProfile` similar to:

```json
{
	"UserId": "AIVAUST4GASIBL1PWO2H9",
	"Account": "123456789101",
	"Arn": "arn:aws:iam::123456789101:user/someusername"
}
```

Requests that do not match an upstream cloud service provider will pass through:

```sh
wget --ca-certificate=${PWD}/.http-mitm-proxy/certs/ca.pem -e use_proxy=yes -e https_proxy=$HTTPS_PROXY https://google.com
```
